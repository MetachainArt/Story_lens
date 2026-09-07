import { describe, expect, it } from 'vitest';
import { sharpenPixels } from '@/utils/sharpness';

function row(values: number[], alpha = 255) {
  return { width: values.length, height: 1, data: new Uint8ClampedArray(values.flatMap(value => [value, value, value, alpha])) };
}

describe('positive image sharpness', () => {
  it('increases the contrast at a real edge without moving pixels', () => {
    const pixels = row([80, 80, 120, 120]);
    sharpenPixels(pixels, 50);
    expect(Array.from(pixels.data)).toEqual(Array.from(row([80, 60, 140, 120]).data));
  });

  it('leaves an unedited image and a uniform area unchanged', () => {
    const original = row([80, 80, 120, 120]);
    const copy = original.data.slice();
    sharpenPixels(original, 0);
    expect(original.data).toEqual(copy);
    const flat = { width: 2, height: 2, data: row([93, 93, 93, 93]).data };
    sharpenPixels(flat, 50);
    expect(flat.data).toEqual(row([93, 93, 93, 93]).data);
  });

  it('does not sharpen repeatedly from already modified neighbouring rows', () => {
    const pixels = { width: 1, height: 4, data: row([80, 80, 120, 120]).data };
    sharpenPixels(pixels, 50);
    expect(pixels.data).toEqual(row([80, 60, 140, 120]).data);
  });

  it('clamps channels and keeps alpha and transparent areas intact', () => {
    const pixels = row([0, 0, 255, 255]);
    sharpenPixels(pixels, 50);
    expect(pixels.data).toEqual(row([0, 0, 255, 255]).data);
    const transparent = row([80, 80, 120, 120], 0);
    const before = transparent.data.slice();
    sharpenPixels(transparent, 50);
    expect(transparent.data).toEqual(before);
  });
});
