import { readFileSync } from "fs";
import { join } from "path";
import { cwd } from "process";

const packageJsonPath: string = join(cwd(), "package.json");
const packageJson = JSON.parse(readFileSync(packageJsonPath));
const properties = packageJson.contributes.configuration.properties;

console.log("|Config|Description|Default|");
console.log("|-|-|-|");

Object.keys(properties).forEach(val => {
    const prop = properties[val];
    console.log(`|\`${val}\`|${prop.description}|\`${prop.default}\`|`);
});