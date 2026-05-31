import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export interface ExtractedComponent {
  name:      string
  type:      'hardware' | 'electronic' | 'fastener' | 'tool' | 'other'
  quantity:  number | null
  unit:      string | null
  bambu_sku: string | null
  notes:     string | null
}

const EXTRACTION_PROMPT = `You are analyzing a 3D printing project description to extract a list of required hardware components, electronic parts, fasteners, and non-filament materials needed to complete the project.

Extract ONLY physical components the maker needs to purchase or have on hand. Do NOT include filament, slicer settings, or printing instructions.

Return ONLY a JSON array with no other text, markdown, or explanation. Each item:
{
  "name": "descriptive component name",
  "type": "hardware|electronic|fastener|tool|other",
  "quantity": number or null if unspecified,
  "unit": "pcs|set|m|cm|g|ml or null",
  "bambu_sku": "SKU if a Bambu product like MH001 or KC007, otherwise null",
  "notes": "size/spec details like M3x8mm or 5V 2A, or null"
}

Project description:
`

export async function extractComponents(projectText: string): Promise<ExtractedComponent[]> {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn('[componentExtractor] ANTHROPIC_API_KEY not set — skipping extraction')
    return []
  }

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: EXTRACTION_PROMPT + projectText.slice(0, 8000),
        },
      ],
    })

    const textBlock = message.content.find((b) => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') return []

    const raw = textBlock.text.trim()

    // Strip any accidental markdown fences
    const jsonStr = raw
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/, '')
      .trim()

    const parsed = JSON.parse(jsonStr)

    if (!Array.isArray(parsed)) return []

    // Validate and sanitize each item, cap at 20
    return parsed.slice(0, 20).map((item: unknown): ExtractedComponent => {
      const i = item as Record<string, unknown>
      return {
        name:      typeof i.name      === 'string' ? i.name.trim()       : 'Unknown component',
        type:      (['hardware','electronic','fastener','tool','other'] as const)
                     .includes(i.type as ExtractedComponent['type'])
                   ? (i.type as ExtractedComponent['type'])
                   : 'other',
        quantity:  typeof i.quantity  === 'number' ? i.quantity           : null,
        unit:      typeof i.unit      === 'string' ? i.unit.trim()        : null,
        bambu_sku: typeof i.bambu_sku === 'string' ? i.bambu_sku.trim()   : null,
        notes:     typeof i.notes     === 'string' ? i.notes.trim()       : null,
      }
    })
  } catch (err) {
    // Never throw — return empty array on any failure
    console.error('[componentExtractor] Failed to extract components:', err)
    return []
  }
}
