import sys

import matplotlib.pyplot as plt
import numpy as np
from PIL import Image


def load_ycbcr(path: str) -> np.ndarray:
    return np.asarray(Image.open(path).convert("YCbCr"), dtype=np.float32)


def sample_pixels(a: np.ndarray, b: np.ndarray, limit: int = 100_000):
    a = a.reshape(-1)
    b = b.reshape(-1)

    if len(a) <= limit:
        return a, b

    indexes = np.linspace(0, len(a) - 1, limit, dtype=np.int64)
    return a[indexes], b[indexes]


def plot_histograms(original: np.ndarray, received: np.ndarray, output: str):
    names = ["Y", "Cb", "Cr"]

    fig, axes = plt.subplots(3, 1, figsize=(10, 12))

    for channel, ax in enumerate(axes):
        ax.hist(
            original[:, :, channel].reshape(-1),
            bins=256,
            range=(0, 256),
            histtype="step",
            label="Original",
        )
        ax.hist(
            received[:, :, channel].reshape(-1),
            bins=256,
            range=(0, 256),
            histtype="step",
            label="Received",
        )
        ax.set_title(f"{names[channel]} histogram")
        ax.set_xlim(0, 255)
        ax.set_xlabel("Channel value")
        ax.set_ylabel("Pixel count")
        ax.legend()

    fig.tight_layout()
    fig.savefig(output, dpi=160)
    plt.close(fig)


def plot_scatter(original: np.ndarray, received: np.ndarray, output: str):
    names = ["Y", "Cb", "Cr"]

    fig, axes = plt.subplots(1, 3, figsize=(18, 6))

    for channel, ax in enumerate(axes):
        x, y = sample_pixels(
            original[:, :, channel],
            received[:, :, channel],
        )

        slope, intercept = np.polyfit(x, y, 1)
        predicted = slope * x + intercept
        residual = y - predicted
        r_squared = 1 - np.sum(residual**2) / np.sum((y - y.mean()) ** 2)

        ax.scatter(x, y, s=1, alpha=0.08)
        ax.plot([0, 255], [0, 255], linestyle="--", label="Unchanged")
        ax.plot(
            [0, 255],
            [intercept, slope * 255 + intercept],
            label=f"fit: y={slope:.4f}x+{intercept:.2f}",
        )
        ax.set_title(f"{names[channel]}, R²={r_squared:.4f}")
        ax.set_xlim(0, 255)
        ax.set_ylim(0, 255)
        ax.set_xlabel("Original")
        ax.set_ylabel("Received")
        ax.legend()

    fig.tight_layout()
    fig.savefig(output, dpi=160)
    plt.close(fig)


def plot_difference(original: np.ndarray, received: np.ndarray, output: str):
    difference = received - original
    names = ["Y difference", "Cb difference", "Cr difference"]

    fig, axes = plt.subplots(1, 3, figsize=(18, 6))

    maximum = max(1, np.percentile(np.abs(difference), 99))

    for channel, ax in enumerate(axes):
        image = ax.imshow(
            difference[:, :, channel],
            vmin=-maximum,
            vmax=maximum,
        )
        ax.set_title(names[channel])
        ax.axis("off")
        fig.colorbar(image, ax=ax)

    fig.tight_layout()
    fig.savefig(output, dpi=160)
    plt.close(fig)


def print_statistics(original: np.ndarray, received: np.ndarray):
    names = ["Y", "Cb", "Cr"]

    for channel, name in enumerate(names):
        a = original[:, :, channel]
        b = received[:, :, channel]
        error = b - a

        slope, intercept = np.polyfit(a.reshape(-1), b.reshape(-1), 1)

        print(name)
        print(f"  original mean: {a.mean():.4f}")
        print(f"  received mean: {b.mean():.4f}")
        print(f"  mean error:    {error.mean():.4f}")
        print(f"  MAE:           {np.abs(error).mean():.4f}")
        print(f"  RMSE:          {np.sqrt(np.mean(error**2)):.4f}")
        print(f"  mapping:       received ≈ {slope:.6f} × original + {intercept:.4f}")


def main():
    if len(sys.argv) != 3:
        raise SystemExit(
            f"Usage: {sys.argv[0]} original.jpg received.jpg"
        )

    original = load_ycbcr(sys.argv[1])
    received = load_ycbcr(sys.argv[2])

    if original.shape != received.shape:
        raise SystemExit(
            f"Image dimensions differ: {original.shape} vs {received.shape}"
        )

    print_statistics(original, received)
    plot_histograms(original, received, "histograms.png")
    plot_scatter(original, received, "scatter.png")
    plot_difference(original, received, "differences.png")


if __name__ == "__main__":
    main()
