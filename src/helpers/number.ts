export function addWithUpperLimit(
  input: number,
  limit: number,
  val = 1,
): number {
  let retval = input + val
  console.log(retval, input, val, limit)
  if (retval >= limit) {
    retval = retval - limit
  }
  return retval
}
