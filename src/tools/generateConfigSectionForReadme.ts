import { readFileSync } from "fs";
import { join } from "path";
import { cwd } from "process";

const packageJsonPath: string = join(cwd(), "package.json");
const packageJson = JSON.parse(readFileSync(packageJsonPath, {encoding: 'utf8'}));
const properties = packageJson.contributes.configuration.properties;

console.log("|Config|Description|Default|");
console.log("|-|-|-|");

Object.keys(properties).forEach(val => {
    const prop = properties[val];
    const description = prop.description.replace(/(\*|<|>)/g, "\\$1");
    console.log(`|\`${val}\`|${description}|\`${JSON.stringify(prop.default)}\`|`);
});
