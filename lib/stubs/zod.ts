const stringSchema = {
  min: () => stringSchema,
  default: () => stringSchema,
};

export const z = {
  string: () => stringSchema,
  enum: <T extends readonly string[]>(_values: T) => ({
    parse: (input: unknown) => input,
  }),
  object: <T>(_shape: T) => ({
    parse: (input: any) => input,
  }),
} as any;
