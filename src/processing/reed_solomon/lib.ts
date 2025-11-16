/* eslint-disable */
// @ts-nocheck

/*#!/usr/bin/env node
 * Original implementation is ZXing and ported to JavaScript by cho45.
 * Copyright 2007 ZXing authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const GenericGF = function () {
  this.init.apply(this, arguments);
};
GenericGF.prototype = {
  init: function (primitive, size, b) {
    this.primitive = primitive;
    this.size = size;
    this.generatorBase = b;

    this.expTable = new Int32Array(size);
    this.logTable = new Int32Array(size);

    let x = 1;
    for (var i = 0; i < size; i++) {
      this.expTable[i] = x;
      x *= 2; // we're assuming the generator alpha is 2
      if (x >= size) {
        x ^= primitive;
        x &= size - 1;
      }
    }
    for (var i = 0; i < size - 1; i++) {
      this.logTable[this.expTable[i]] = i;
    }
    // logTable[0] == 0 but this should never be used

    this.zero = new GenericGFPoly(this, GenericGFPoly.COEFFICIENTS_ZERO);
    this.one = new GenericGFPoly(this, GenericGFPoly.COEFFICIENTS_ONE);
  },

  buildMonomial: function (degree, coefficient) {
    if (degree < 0) {
      throw new Error('IllegalArgumentException()');
    }
    if (coefficient === 0) {
      return this.zero;
    }
    const coefficients = new Int32Array(degree + 1);
    coefficients[0] = coefficient;
    return new GenericGFPoly(this, coefficients);
  },

  getZero: function () {
    return this.zero;
  },

  getOne: function () {
    return this.one;
  },

  exp: function (a) {
    return this.expTable[a];
  },

  log: function (a) {
    if (a === 0) {
      throw new Error('IllegalArgumentException()');
    }
    return this.logTable[a];
  },

  inverse: function (a) {
    if (a === 0) {
      throw new Error('ArithmeticException()');
    }
    return this.expTable[this.size - this.logTable[a] - 1];
  },

  multiply: function (a, b) {
    if (a === 0 || b === 0) {
      return 0;
    }
    return this.expTable[(this.logTable[a] + this.logTable[b]) % (this.size - 1)];
  },

  getSize: function () {
    return this.size;
  },

  getGeneratorBase: function () {
    return this.generatorBase;
  },

  toString: function () {
    return 'GF(0x' + this.primitive.toString(16) + ',' + this.size + ')';
  },
};
GenericGF.addOrSubtract = function (a, b) {
  return a ^ b;
};

var GenericGFPoly = function () {
  this.init.apply(this, arguments);
};
GenericGFPoly.prototype = {
  init: function (field, coefficients) {
    if (coefficients.length === 0) {
      throw new Error('IllegalArgumentException()');
    }
    this.field = field;
    const coefficientsLength = coefficients.length;
    if (coefficientsLength > 1 && coefficients[0] === 0) {
      // Leading term must be non-zero for anything except the constant polynomial "0"
      let firstNonZero = 1;
      while (firstNonZero < coefficientsLength && coefficients[firstNonZero] === 0) {
        firstNonZero++;
      }
      if (firstNonZero == coefficientsLength) {
        this.coefficients = GenericGFPoly.COEFFICIENTS_ZERO;
      } else {
        this.coefficients = coefficients.subarray(firstNonZero, coefficientsLength);
      }
    } else {
      this.coefficients = coefficients;
    }
    this.degree = this.coefficients.length - 1;
  },

  getCoefficients: function () {
    return this.coefficients;
  },

  getDegree: function () {
    return this.degree;
  },

  isZero: function () {
    return this.coefficients[0] === 0;
  },

  getCoefficient: function (degree) {
    return this.coefficients[this.coefficients.length - 1 - degree];
  },

  evaluateAt: function (a) {
    if (a === 0) {
      // Just return the x^0 coefficient
      return this.getCoefficient(0);
    }
    const coefficients = this.coefficients;
    const size = coefficients.length;
    let result;
    if (a == 1) {
      // Just the sum of the coefficients
      result = 0;
      for (var i = 0, len = coefficients.length; i < len; i++) {
        result = GenericGF.addOrSubtract(result, coefficients[i]);
      }
      return result;
    }

    result = coefficients[0];
    for (var i = 1; i < size; i++) {
      result = GenericGF.addOrSubtract(this.field.multiply(a, result), coefficients[i]);
    }
    return result;
  },

  addOrSubtract: function (other, buf) {
    if (this.field !== other.field) {
      throw new Error('IllegalArgumentException("GenericGFPolys do not have same GenericGF field")');
    }
    if (this.isZero()) {
      return other;
    }
    if (other.isZero()) {
      return this;
    }

    let smallerCoefficients = this.coefficients;
    let largerCoefficients = other.coefficients;
    if (smallerCoefficients.length > largerCoefficients.length) {
      const temp = smallerCoefficients;
      smallerCoefficients = largerCoefficients;
      largerCoefficients = temp;
    }
    const sumDiff = buf ? buf.subarray(0, largerCoefficients.length) : new Int32Array(largerCoefficients.length);
    const lengthDiff = largerCoefficients.length - smallerCoefficients.length;
    for (let i = lengthDiff; i < largerCoefficients.length; i++) {
      sumDiff[i] = GenericGF.addOrSubtract(smallerCoefficients[i - lengthDiff], largerCoefficients[i]);
    }
    // Copy high-order terms only found in higher-degree polynomial's coefficients
    sumDiff.set(largerCoefficients.subarray(0, lengthDiff));

    return new GenericGFPoly(this.field, sumDiff);
  },

  multiply: function (other) {
    if (other instanceof GenericGFPoly) {
      return this.multiplyGenericGFPoly(other);
    } else {
      return this.multiplyScalar(other);
    }
  },

  multiplyGenericGFPoly: function (other) {
    if (this.field !== other.field) {
      throw new Error('IllegalArgumentException("GenericGFPolys do not have same GenericGF field")');
    }
    if (this.isZero() || other.isZero()) {
      return this.field.zero;
    }
    const aCoefficients = this.coefficients;
    const aLength = aCoefficients.length;
    const bCoefficients = other.coefficients;
    const bLength = bCoefficients.length;
    const product = new Int32Array(aLength + bLength - 1);
    for (let i = 0; i < aLength; i++) {
      const aCoeff = aCoefficients[i];
      for (let j = 0; j < bLength; j++) {
        product[i + j] = GenericGF.addOrSubtract(product[i + j], this.field.multiply(aCoeff, bCoefficients[j]));
      }
    }
    return new GenericGFPoly(this.field, product);
  },

  multiplyScalar: function (scalar) {
    if (scalar === 0) {
      return this.field.zero;
    }
    if (scalar == 1) {
      return this;
    }
    const size = this.coefficients.length;
    const product = new Int32Array(size);
    for (let i = 0; i < size; i++) {
      product[i] = this.field.multiply(this.coefficients[i], scalar);
    }
    return new GenericGFPoly(this.field, product);
  },

  multiplyByMonomial: function (degree, coefficient) {
    if (degree < 0) {
      throw new Error('IllegalArgumentException()');
    }
    if (coefficient === 0) {
      return this.field.zero;
    }
    const size = this.coefficients.length;
    const product = new Int32Array(size + degree);
    for (let i = 0; i < size; i++) {
      product[i] = this.field.multiply(this.coefficients[i], coefficient);
    }
    return new GenericGFPoly(this.field, product);
  },

  divide: function (other) {
    if (this.field !== other.field) {
      throw new Error('IllegalArgumentException("GenericGFPolys do not have same GenericGF field")');
    }
    if (other.isZero()) {
      throw new Error('IllegalArgumentException("Divide by 0")');
    }

    let quotient = this.field.getZero();
    let remainder = this;

    const denominatorLeadingTerm = other.getCoefficient(other.degree);
    const inverseDenominatorLeadingTerm = this.field.inverse(denominatorLeadingTerm);

    while (remainder.degree >= other.degree && !remainder.isZero()) {
      const degreeDifference = remainder.degree - other.degree;
      const scale = this.field.multiply(remainder.getCoefficient(remainder.degree), inverseDenominatorLeadingTerm);
      const term = other.multiplyByMonomial(degreeDifference, scale);
      const iterationQuotient = this.field.buildMonomial(degreeDifference, scale);
      quotient = quotient.addOrSubtract(iterationQuotient, quotient.coefficients);
      remainder = remainder.addOrSubtract(term, remainder.coefficients);
    }

    return [quotient, remainder];
  },

  toString: function () {
    let result = '';
    for (let degree = this.degree; degree >= 0; degree--) {
      let coefficient = this.getCoefficient(degree);
      if (coefficient !== 0) {
        if (coefficient < 0) {
          result += ' - ';
          coefficient = -coefficient;
        } else {
          if (result.length > 0) {
            result += ' + ';
          }
        }
        if (degree === 0 || coefficient != 1) {
          const alphaPower = this.field.log(coefficient);
          if (alphaPower === 0) {
            result += '1';
          } else if (alphaPower == 1) {
            result += 'a';
          } else {
            result += 'a^';
            result += alphaPower;
          }
        }
        if (degree !== 0) {
          if (degree == 1) {
            result += 'x';
          } else {
            result += 'x^';
            result += degree;
          }
        }
      }
    }
    return result.toString();
  },
};
GenericGFPoly.COEFFICIENTS_ZERO = new Int32Array([0]);
GenericGFPoly.COEFFICIENTS_ONE = new Int32Array([1]);

const ReedSolomonEncoder = function () {
  this.init.apply(this, arguments);
};
ReedSolomonEncoder.prototype = {
  init: function (field) {
    this.field = field;
    this.cachedGenerators = [];
    this.cachedGenerators.push(new GenericGFPoly(field, new Int32Array([1])));
  },

  buildGenerator: function (degree) {
    if (degree >= this.cachedGenerators.length) {
      let lastGenerator = this.cachedGenerators[this.cachedGenerators.length - 1];
      for (let d = this.cachedGenerators.length; d <= degree; d++) {
        const nextGenerator = lastGenerator.multiply(
          new GenericGFPoly(this.field, new Int32Array([1, this.field.exp(d - 1 + this.field.generatorBase)])),
        );
        this.cachedGenerators.push(nextGenerator);
        lastGenerator = nextGenerator;
      }
    }
    return this.cachedGenerators[degree];
  },

  encode: function (toEncode, ecBytes) {
    if (ecBytes === 0) {
      throw new Error('IllegalArgumentException("No error correction bytes")');
    }
    const dataBytes = toEncode.length - ecBytes;
    if (dataBytes <= 0) {
      throw new Error('IllegalArgumentException("No data bytes provided")');
    }
    const generator = this.buildGenerator(ecBytes);
    const infoCoefficients = new Int32Array(dataBytes);
    infoCoefficients.set(toEncode.subarray(0, dataBytes));

    let info = new GenericGFPoly(this.field, infoCoefficients);
    info = info.multiplyByMonomial(ecBytes, 1);
    const remainder = info.divide(generator)[1];
    const coefficients = remainder.coefficients;
    const numZeroCoefficients = ecBytes - coefficients.length;
    for (let i = 0; i < numZeroCoefficients; i++) {
      toEncode[dataBytes + i] = 0;
    }
    toEncode.set(coefficients.subarray(0, coefficients.length), dataBytes + numZeroCoefficients);
  },
};

const ReedSolomonDecoder = function () {
  this.init.apply(this, arguments);
};
ReedSolomonDecoder.prototype = {
  init: function (field) {
    this.field = field;
  },

  decode: function (received, twoS) {
    const poly = new GenericGFPoly(this.field, received);
    const syndromeCoefficients = new Int32Array(twoS);
    let noError = true;
    for (var i = 0; i < twoS; i++) {
      const eval_ = poly.evaluateAt(this.field.exp(i + this.field.generatorBase));
      syndromeCoefficients[syndromeCoefficients.length - 1 - i] = eval_;
      if (eval_ !== 0) {
        noError = false;
      }
    }

    if (noError) {
      return;
    }
    const syndrome = new GenericGFPoly(this.field, syndromeCoefficients);
    const sigmaOmega = this.runEuclideanAlgorithm(this.field.buildMonomial(twoS, 1), syndrome, twoS);
    const sigma = sigmaOmega[0];
    const omega = sigmaOmega[1];
    const errorLocations = this.findErrorLocations(sigma);
    const errorMagnitudes = this.findErrorMagnitudes(omega, errorLocations);
    for (var i = 0; i < errorLocations.length; i++) {
      const position = received.length - 1 - this.field.log(errorLocations[i]);
      if (position < 0) {
        throw new Error('ReedSolomonException("Bad error location")');
      }
      received[position] = GenericGF.addOrSubtract(received[position], errorMagnitudes[i]);
    }
  },

  runEuclideanAlgorithm: function (a, b, R) {
    // Assume a's degree is >= b's
    if (a.degree < b.degree) {
      const temp = a;
      a = b;
      b = temp;
    }

    let rLast = a;
    let r = b;
    let tLast = this.field.zero;
    let t = this.field.one;

    // Run Euclidean algorithm until r's degree is less than R/2
    while (r.degree >= R / 2) {
      const rLastLast = rLast;
      const tLastLast = tLast;
      rLast = r;
      tLast = t;

      // Divide rLastLast by rLast, with quotient in q and remainder in r
      if (rLast.isZero()) {
        // Oops, Euclidean algorithm already terminated?
        throw new Error('ReedSolomonException("r_{i-1} was zero")');
      }
      r = rLastLast;
      let q = this.field.zero;
      const denominatorLeadingTerm = rLast.getCoefficient(rLast.degree);
      const dltInverse = this.field.inverse(denominatorLeadingTerm);
      while (r.degree >= rLast.degree && !r.isZero()) {
        const degreeDiff = r.degree - rLast.degree;
        const scale = this.field.multiply(r.getCoefficient(r.degree), dltInverse);
        q = q.addOrSubtract(this.field.buildMonomial(degreeDiff, scale));
        r = r.addOrSubtract(rLast.multiplyByMonomial(degreeDiff, scale));
      }

      t = q.multiply(tLast).addOrSubtract(tLastLast);

      if (r.degree >= rLast.degree) {
        throw new Error('IllegalStateException("Division algorithm failed to reduce polynomial?")');
      }
    }

    const sigmaTildeAtZero = t.getCoefficient(0);
    if (sigmaTildeAtZero === 0) {
      throw new Error('ReedSolomonException("sigmaTilde(0) was zero")');
    }

    const inverse = this.field.inverse(sigmaTildeAtZero);
    const sigma = t.multiply(inverse);
    const omega = r.multiply(inverse);
    return [sigma, omega];
  },

  findErrorLocations: function (errorLocator) {
    // This is a direct application of Chien's search
    const numErrors = errorLocator.degree;
    if (numErrors == 1) {
      // shortcut
      return new Int32Array([errorLocator.getCoefficient(1)]);
    }
    const result = new Int32Array(numErrors);
    let e = 0;
    for (let i = 1; i < this.field.size && e < numErrors; i++) {
      if (errorLocator.evaluateAt(i) === 0) {
        result[e] = this.field.inverse(i);
        e++;
      }
    }
    if (e != numErrors) {
      throw new Error('ReedSolomonException("Error locator degree does not match number of roots")');
    }
    return result;
  },

  findErrorMagnitudes: function (errorEvaluator, errorLocations) {
    // This is directly applying Forney's Formula
    const s = errorLocations.length;
    const result = new Int32Array(s);
    for (let i = 0; i < s; i++) {
      const xiInverse = this.field.inverse(errorLocations[i]);
      let denominator = 1;
      for (let j = 0; j < s; j++) {
        if (i != j) {
          denominator = this.field.multiply(
            denominator,
            GenericGF.addOrSubtract(1, this.field.multiply(errorLocations[j], xiInverse)),
          );
        }
      }
      result[i] = this.field.multiply(errorEvaluator.evaluateAt(xiInverse), this.field.inverse(denominator));
      if (this.field.generatorBase !== 0) {
        result[i] = this.field.multiply(result[i], xiInverse);
      }
    }
    return result;
  },
};

// System.arraycopy(src, srcPos, dest, destPos, length);
// dest.set(src.subarray(srcPos, srcPos + length), destPos);

function lazy(func) {
  let val;
  return function () {
    if (!val) {
      val = func();
    }
    return val;
  };
}

GenericGF.AZTEC_DATA_12 = lazy(function () {
  return new GenericGF(0x1069, 4096, 1);
}); // x^12 + x^6 + x^5 + x^3 + 1
GenericGF.AZTEC_DATA_10 = lazy(function () {
  return new GenericGF(0x409, 1024, 1);
}); // x^10 + x^3 + 1
GenericGF.AZTEC_DATA_6 = lazy(function () {
  return new GenericGF(0x43, 64, 1);
}); // x^6 + x + 1
GenericGF.AZTEC_PARAM = lazy(function () {
  return new GenericGF(0x13, 16, 1);
}); // x^4 + x + 1
GenericGF.QR_CODE_FIELD_256 = lazy(function () {
  return new GenericGF(0x011d, 256, 0);
}); // x^8 + x^4 + x^3 + x^2 + 1
GenericGF.DATA_MATRIX_FIELD_256 = lazy(function () {
  return new GenericGF(0x012d, 256, 1);
}); // x^8 + x^5 + x^3 + x^2 + 1
GenericGF.AZTEC_DATA_8 = GenericGF.DATA_MATRIX_FIELD_256;
GenericGF.MAXICODE_FIELD_64 = GenericGF.AZTEC_DATA_6;

// this.GenericGF = GenericGF;
// this.GenericGFPoly = GenericGFPoly;
// this.ReedSolomonEncoder = ReedSolomonEncoder;
// this.ReedSolomonDecoder = ReedSolomonDecoder;

function dump(array) {
  console.log(Array.prototype.join.call(array));
}

export { GenericGF, GenericGFPoly, ReedSolomonEncoder, ReedSolomonDecoder };
