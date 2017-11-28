interface jschardetReturn {
  encoding: string;
  confidence: number;
}

declare module "jschardet" {
  function detect(detect: string): jschardetReturn;
}
