# src map

- `driver` - low-level interface stuff
  - `inference` - text generation and embedding drivers
    - `basilisk` - inference/embedding driver for basilisk
    - `textgen` - inference driver for text-generation-webui (and compatible)
    - `openai` - inference/embedding driver for OpenAI-compatible services
  - `storage` - long-term storage drivers
    - `vector` - vector storage drivers
      - `postgres` - pgvector driver
- `format` - context formatting code
- `memory` - memory providers
  - `conversation` - conversation memory
    - `window` - ephemeral rolling window memory (short-term)
    - `vector` - conversation fragment vector memory (long-term)
- `bridge` - packages drivers and memories together into a single abstracted
  object
- `message` - internal object model for chat messages
- `util` - misc stuff