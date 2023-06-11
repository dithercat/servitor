<img src="images/logo.png" width="256"/>

# servitor

stupid simple LLM chatbot framework designed for multiuser chats

currently extremely unstable and not really ready for use

if you just want to make a discord LLM bot, see
[ensata](https://github.com/dithercat/ensata), the reference implementation of
servitor

## features

- interchangeable inference/embedding drivers
  - [basilisk](https://github.com/dithercat/basilisk) (recommended)
    - developed in parallel with servitor and supports all the features it uses
  - [text-generation-webui](https://github.com/oobabooga/text-generation-webui)
    and compatible API services (incomplete)
    - does not natively support embeddings, which are required for long-term
      memory
  - OpenAI-compatible API services (incomplete)
    - does not currently support token counting, resulting in inefficient
      context space allocation
  - writing your own driver for something else should be pretty easy
    (see `src/driver/base.ts`)
- dynamic context reallocation
  - context is windowed to 2048 tokens (for LLaMA)
  - if some piece of information (such as long-term memory) is injected into the
    context, then the conversation window shrinks to accomodate it and expands
    again once that information is removed
- universal internal monologue system
  - allows better planning of replies
  - as a side-effect, creates some level of self-consistency for the simulacrum
- vector memory (still ironing this out)
  - persistent driver backed by [pgvector](https://github.com/pgvector/pgvector)
  - simple in-memory driver

## faq

- **who is this for?** - primarily, myself. however, im releasing this publicly
  with the hope that someone else who wants to build a chatbot for i.e. discord
  will find it useful.

- **why not just use langchain?** - it doesnt support multiuser chats, only
  one-on-one conversations between "Human" and "AI". i investigated using it,
  but ultimately i had to roll every part of the stack for this use case myself
  anyway, so it wasnt worth it.

- **why "servitor"?** - this library is named after [the chaos magic concept of
  the same name](https://en.wikipedia.org/wiki/Servitor_(chaos_magic)), because
  the concepts, motivations, and processes involved in the construction of
  servitors operating within the framework of a human psyche has interesting
  parallels with that of agent simulacra operating within the framework of
  humanity's collective psyche as distilled into LLMs.

  and in both cases, as per rule #3 of `sudo`, with great power comes great
  responsibility.