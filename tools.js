#!/usr/bin/env -S deno run --allow-all
import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.43/deno-dom-wasm.ts"
// import { Parser, parserFromWasm } from "https://deno.land/x/deno_tree_sitter@0.1.3.0/main.js"
// import html from "https://github.com/jeff-hykin/common_tree_sitter_languages/raw/4d8a6d34d7f6263ff570f333cdcf5ded6be89e3d/main/html.js"


export async function searchBasePackage(query) {
    try {
        const url = `https://www.nixhub.io/search?q=${encodeURIComponent(query)}`
        const htmlResult = await fetch(url).then(result=>result.text())
        var document = new DOMParser().parseFromString(
            htmlResult,
            "text/html",
        )
        const list = document.querySelector("ul")
        if (!list) {
            throw Error(`Looks like www.nixhub.io has updated, meaning this CLI tool needs to be updated (issue finding base names $("ul"))` )
        }
        const searchResults = [...list.querySelectorAll("li")]
        return searchResults.map(each=>{
            const dataDiv = each.querySelector("div")
            const output = {
                attrPath: each.querySelector("h3").innerText,
            }
            if (dataDiv) {
                let key
                for (const each of [...dataDiv.children]) {
                    if (each.tagName == "DT") {
                        key = each.innerText.trim()
                    }
                    if (key && each.tagName == "DD") {
                        output[key] = each.innerText
                    }
                }
            }
            return output
        })
    } catch (error) {
        throw Error(`Unable to connect to nixhub.io, ${error}`)
    }
}

export async function getVersionsFor(attrPath) {
    const url = `https://www.nixhub.io/packages/${encodeURIComponent(attrPath)}`
    const htmlResult = await fetch(url).then(result=>result.text())
    const document = new DOMParser().parseFromString(
        htmlResult,
        "text/html",
    )
    const list = document.querySelector("main ul")
    if (!list) {
        throw Error(`Looks like www.nixhub.io has updated, meaning this CLI tool needs to be updated (issue finding list $("main ul"))` )
    }
    const versionElements = [...list.querySelectorAll("li")]
    const versionResults = []
    const prefixForVersionString = "Version "
    for (const eachVersion of versionElements) {
        const divs = [...eachVersion.querySelectorAll("div")]
        const versionStringDiv = divs.filter(each=>each.innerText.startsWith(prefixForVersionString))
        if (!versionStringDiv) {
            throw Error(`Looks like www.nixhub.io has updated, meaning this CLI tool needs to be updated (issue finding version string div)` )
        }
        const version = versionStringDiv[0].innerText.slice(prefixForVersionString.length,)
        const referenceInfoOuterDiv = divs.filter(each=>[...each.children].some(subChild=>subChild.innerText.match(/Nixpkgs Reference/)))[0]
        if (!referenceInfoOuterDiv) {
            throw Error(`Looks like www.nixhub.io has updated, meaning this CLI tool needs to be updated (issue finding version info within list element)` )
        }
        const referenceInfoInnerDiv = [...referenceInfoOuterDiv.querySelectorAll("div")].filter(each=>each.innerText.match("#"))
        const hashAndAttrName = referenceInfoOuterDiv.innerText.replace(/^\s*Nixpkgs Reference\s*/,"").split(/ *# */) 
        if (!(hashAndAttrName.length == 2)) {
            throw Error(`Looks like www.nixhub.io has updated, meaning this CLI tool needs to be updated (issue extracting referece hash from referece hash div)` )
        }
        versionResults.push({
            version,
            hash: hashAndAttrName[0],
            attrName: hashAndAttrName[1],
        })
    }
    return versionResults
}

export async function search(query) {
    const basePackages = await searchBasePackage(query)
    for (const value of basePackages) {
        value.versionsPromise = getVersionsFor(value.attrPath)
    }
    return basePackages
}