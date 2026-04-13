const _isTTY =
  !!process.stdout.isTTY &&
  !!process.stderr.isTTY &&
  process.env.CI !== "true" &&
  !process.env.GITHUB_ACTIONS &&
  process.env.TERM !== "dumb";

const _isStdoutPiped = !process.stdout.isTTY;

export function isTTY(): boolean {
  return _isTTY;
}

export function isStdoutPiped(): boolean {
  return _isStdoutPiped;
}
