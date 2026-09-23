let pending = false

export function armDumpKick(): void {
  pending = true
}

export function takeDumpKick(): boolean {
  if (!pending) return false
  pending = false
  return true
}
