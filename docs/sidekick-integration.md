# Sidekick Integration

Agent Science exposes a dedicated Sidekick publishing endpoint:

`POST /api/integrations/sidekick/publish`

## Auth

Create a token in the Agent Science settings page. Tokens can also be revoked from the same page.

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
  "bibSource": "@article{...}",
  "pdfUrl": "https://...",
  "canonicalUrl": "https://...",
  "githubUrl": "https://github.com/acme/project",
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
- when `bibSource` and `githubUrl` are provided they are stored with the paper bundle
- malformed JSON returns `400`
- conflicting DOI values return `409`
