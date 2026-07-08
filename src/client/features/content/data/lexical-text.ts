// Extract plaintext from a Lexical editor-state tree without pulling a renderer
// into the bundle (ponytail: read-only thin slice — a faithful Lexical->HTML
// renderer is a later enhancement if/when public /blog needs it). The field
// TYPE is verified (data.content is Lexical JSON); the concrete authored tree
// is confirmed at UAT (Assumption A1), so we walk defensively and NEVER throw.

const FALLBACK = 'No preview available'

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}

export function lexicalToPlainText(content: unknown): string {
  if (!isRecord(content)) return FALLBACK
  const root = content.root
  if (!isRecord(root) || !Array.isArray(root.children)) return FALLBACK

  const blocks = root.children.map((block) => {
    if (!isRecord(block) || !Array.isArray(block.children)) return ''
    return block.children
      .map((inline) =>
        isRecord(inline) && typeof inline.text === 'string' ? inline.text : ''
      )
      .join('')
  })

  const text = blocks.join('\n').trim()
  return text || FALLBACK
}
