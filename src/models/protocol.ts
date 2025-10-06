// 1. 4 bytes: error correction bits number
// 2. 4 more bytes: error correction for (1)
// 3. type: 0 - text; 1 - file
// 4. if type==1, filename length, 1 byte
// 5. filename symbols
// 6. data length
// 7. data symbols
// 8. error correction symbols (the rest)
