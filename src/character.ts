// xe/xem is very useful as a placeholder pronoun as every conjugation
// is distinct
export interface ServitorPronounDescriptor {
    xe: string,
    xem: string,
    xyr: string,
    xyrs: string,
    xemself: string
}

// warmup message, to steer the general conversation trajectory
// also useful as a one-shot example of how internal_monologue works
export interface ServitorWarmupDescriptor {
    thought: string,
    response: string
}

export interface ServitorAgentDescriptor {
    // the agent's name
    name: string,
    // additional flavor text used in characterizing it
    // may or may not be utilized by the preconditioning
    extra?: string,
    // pronouns to use in characterizing it
    // may or may not be utilized by the preconditioning
    pronouns: ServitorPronounDescriptor,
    // warmup to use
    warmup?: ServitorWarmupDescriptor
}