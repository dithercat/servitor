# src map

- `driver` - low-level interface stuff
  - `inference` - text generation and embedding drivers
    - `basilisk` - inference/embedding driver for basilisk
    - `textgen` - inference driver for text-generation-webui and compatible
    - `openai` - inference/embedding driver for OpenAI-compatible services
  - `storage` - long-term storage drivers
    - `vector` - vector storage drivers
      - `postgres` - pgvector driver
      - `ephemeral` - RAM-backed driver
- `memory` - memory providers
  - `conversation` - conversation memory
    - `window` - ephemeral rolling window memory (short-term)
    - `vector` - conversation fragment vector memory (long-term)
  - `knowledge` - knowledge memory
    - `static` - returns a static chunk of text
    - `mapper` - switches in the most salient chunks of text based on the most
                 recent message
- `bridge` - packages drivers and memories together into a single abstracted
             object
- `format` - context formatting code
- `message` - internal object model for chat messages
- `util` - misc stuff