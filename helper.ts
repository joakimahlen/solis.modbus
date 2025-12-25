export class HelperService {
  static delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  static hasBitValue(value: number, bitValue: number): boolean {
    return (value & bitValue) === bitValue;
  }
}
