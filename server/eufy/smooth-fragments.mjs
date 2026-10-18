/** The SDK timestamps video at network arrival. Pace each GOP evenly without
 * changing its total duration, decode time, compressed images or audio samples. */
export function smoothVideoFragment(input, videoTrackId = 1) {
  const boxes = (start, end) => {
    const result = [];
    for (let offset = start; offset + 8 <= end;) {
      const size = input.readUInt32BE(offset);
      if (size < 8 || offset + size > end) return [];
      result.push({ type: input.toString('ascii', offset + 4, offset + 8), start: offset + 8, end: offset + size });
      offset += size;
    }
    return result;
  };
  let output;
  for (const moof of boxes(0, input.length).filter(box => box.type === 'moof')) {
    for (const traf of boxes(moof.start, moof.end).filter(box => box.type === 'traf')) {
      const children = boxes(traf.start, traf.end);
      const header = children.find(box => box.type === 'tfhd');
      if (!header || header.end - header.start < 8 || input.readUInt32BE(header.start + 4) !== videoTrackId) continue;
      for (const run of children.filter(box => box.type === 'trun')) {
        if (run.end - run.start < 8) continue;
        const flags = input.readUIntBE(run.start + 1, 3);
        if (!(flags & 0x100)) continue;
        const count = input.readUInt32BE(run.start + 4);
        if (count < 2 || count > 10000) continue;
        const stride = 4 * [0x100, 0x200, 0x400, 0x800].filter(flag => flags & flag).length;
        const first = run.start + 8 + (flags & 1 ? 4 : 0) + (flags & 4 ? 4 : 0);
        if (first + count * stride > run.end) continue;
        const durations = Array.from({ length: count }, (_, index) => input.readUInt32BE(first + index * stride));
        const total = durations.reduce((sum, duration) => sum + duration, 0);
        const average = total / count;
        // The SDK video clock is 90 kHz. Leave real long interruptions intact.
        if (average < 1500 || average > 22500 || durations.some(duration => duration > 180000)) continue;
        output ??= Buffer.from(input);
        for (let index = 0; index < count; index++) {
          const duration = Math.round((index + 1) * total / count) - Math.round(index * total / count);
          output.writeUInt32BE(duration, first + index * stride);
        }
      }
    }
  }
  return output ?? input;
}
