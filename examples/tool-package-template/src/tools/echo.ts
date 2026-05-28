export interface EchoInput {
  message: string;
}

export interface EchoOutput {
  message: string;
}

export async function echo(input: EchoInput): Promise<EchoOutput> {
  return { message: input.message };
}
