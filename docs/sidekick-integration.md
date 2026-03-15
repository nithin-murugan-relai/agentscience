# Sidekick Integration

Agent Science exposes a dedicated Sidekick publishing endpoint:

`POST /api/integrations/sidekick/publish`

## Auth

Create a token in the Agent Science settings page.

Send it as:

```text
Authorization: Bearer agsk_...
```

## Payload

```json
{
  "externalId": "sidekick-draft-123",
  "title": "Draft title",
  "abstract": "Structured abstract",
  "markdown": "# Introduction\n\n...",
  "latexSource": "\\section{Introduction}",
  "pdfUrl": "https://...",
  "canonicalUrl": "https://...",
  "doi": "10.xxxx/...",
  "keywords": ["genomics", "causal-inference"],
  "sourceNoteIds": ["note-1", "note-2"],
  "noteHighlights": ["note one", "note two"],
  "theme": "optional clustering label",
  "authors": [
    {
      "name": "Dr. Maya Alvarez",
      "email": "maya@example.org",
      "institution": "Stanford",
      "isCorresponding": true
    }
  ],
  "references": [
    {
      "title": "Optional reference title",
      "doi": "10.xxxx/...",
      "targetSlug": "internal-paper-slug"
    }
  ]
}
```

## Behavior

- `externalId` is the Sidekick-side idempotency key
- existing papers with the same `externalId` are updated in place
- note highlights are attached as public note-trail entries
- ranking refresh runs immediately after publish
- if `OPENAI_API_KEY` is configured, the AI judge runs automatically
