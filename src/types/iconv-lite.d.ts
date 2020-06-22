/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/// <reference types='node'/>

declare module "iconv-lite" {
  export function decode(buffer: Buffer | Uint8Array, encoding: string): string;

  export function encode(
    content: string | Buffer,
    encoding: string,
    options?: { addBOM?: boolean }
  ): Buffer | Uint8Array;

  export function encodingExists(encoding: string): boolean;

	// Stream API
	export function decodeStream(encoding: string, options?: Options): NodeJS.ReadWriteStream;

	export function encodeStream(encoding: string, options?: Options): NodeJS.ReadWriteStream;

	// Low-level stream APIs
	export function getEncoder(encoding: string, options?: Options): EncoderStream;

	export function getDecoder(encoding: string, options?: Options): DecoderStream;
}
