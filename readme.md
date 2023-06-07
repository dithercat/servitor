<img src="images/logo.png" width="256"/>

# servitor

stupid simple LLM chatbot framework designed for multiuser chats

if you just want to make a discord LLM bot, see [ensata](https://github.com/dithercat/ensata)

## features

- swappable inference backend drivers
  - currently supports [basilisk](https://github.com/dithercat/basilisk)
  (recommended) and
  [text-generation-webui](https://github.com/oobabooga/text-generation-webui)
  - writing your own driver for something else should be pretty easy
    (see `src/driver/base.ts`)
- dynamic context reallocation
  - context is windowed to 2048 tokens (for LLaMA)
  - if some piece of information (such as long-term memory) is injected into the
    context, then the conversation window shrinks to accomodate it and expands
    again once that information is removed
- hacky internal monologue
  - allows better planning of replies
  - as a side-effect, creates some level of self-consistency for the simulacrum
- vector memory (still ironing this out)
  - in-tree implementation is backed by
    [pgvector](https://github.com/pgvector/pgvector)

## components

- `driver` - inference/embedding driver code
- `context` - chat context management
- `storage` - long-term memory stuff (currently only vector memory)
- `bridge` - evil god object that ties everything together

## faq

- **who is this for?** -
  primarily, myself. however, im releasing this publicly with the hope that
  someone else who wants to build a chatbot for i.e. discord will find it
  useful.

- **why not just use langchain?** -
  it doesnt support multiuser chats, only one-on-one conversations between
  "Human" and "AI". i investigated using it, but ultimately i had to roll
  every part of the stack for this use case myself anyway, so it wasnt worth it.