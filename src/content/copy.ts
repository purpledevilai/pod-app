export const copy = {
    screens: {
        start: {
            tagline: 'Everything\nbecomes\nsomething.',
            cta: 'Get Started',
        },
        welcome: {
            title: 'Welcome to Pod',
            bodyMd: `
  We’re so glad you’re here.
  
  Pod is more than an app — it’s a **community** committed to transforming how we relate to materials in our lives.
  
  Every day, we extract more from the Earth — while landfills overflow with untapped potential. *But it doesn’t have to be that way.*
  
  We believe that with better guidance, we can all make choices that integrate with — not work against — our planet’s ecosystem.
  
  And it starts right here, with you, in your home.
  
  Join us, and let’s begin.
        `.trim(),
            ctaNext: 'Next',
        },
        email: {
            title: "What's your email?",
            bodyMd:
                "We’ll use it to create your Pod account — or pick up if you already have one.\n\nWith a Pod account, we can personalize your journey, save your bin system, and help you track your impact over time.",
            placeholder: 'Email',
            ctaSend: 'Send Verification Code',
            ctaSubmitting: 'Sending…',
            errorInvalid: 'Please enter a valid email.',
        },
    },
} as const;
export type AppCopy = typeof copy;