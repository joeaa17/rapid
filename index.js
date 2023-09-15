// const NK = require( 'gnodejs');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const app = express();

// Enhance your app security with Helmet
app.use(helmet());

// Serve static files from the 'public' directory
app.use(express.static('public'));

// Setup CORS to allow requests only from the same domain
const corsOptions = {
  origin: 'http://localhost:3000',  // or your domain name
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));



app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// const sharp = require( 'sharp');
const axios = require( 'axios');
// const { imageTracer } = require( 'imagetracer')
// const { optimize } = require( 'svgo');

const { promises: fsPromises } = require('fs');

const nodemailer = require( 'nodemailer');

const { JSDOM, VirtualConsole } = require('jsdom');
// const {WebScreenShot,WebPdf,valid_devices} = require('@sl-code-lords/web_screenshot')
// const web = require("web-screenshot.js")


const dotenv = require( 'dotenv');
const { escape } = require('querystring');


let initalize = 0;
// const filePath = './src/ai/model.gguf';
const filePath = '/var/data/model.gguf';


const defaultOptions = {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.163 Safari/537.36', // Set a modern user agent
    runScripts: 'dangerously', // Run scripts on the page
    resources: 'usable', // Load resources like images and scripts
    pretendToBeVisual: true, // Pretend to be a visual browser
    virtualConsole: new VirtualConsole(), // Create a virtual console for logging
  };

async function loadPageSource(url, navigate) {
    try {
        const dom = await JSDOM.fromURL(url, defaultOptions);

        let { window } = dom;
        let document = window.document;

        const navigateSteps = navigate ? decodeURIComponent(navigate).split(',') : [];

        for (const step of navigateSteps) {
            const element = document.querySelector(getCSSSelectorByXPath(step));
            console.log('element', element, getCSSSelectorByXPath(step), step);
      
            if (element) {
              // Assuming the element is an anchor tag. Update according to your specific use case.
              if (element.tagName === "A" && element.href) {
                const newURL = element.href;
      
                // Load new page
                const newDom = await JSDOM.fromURL(newURL, defaultOptions);
                window = newDom.window;
                document = window.document;
              }
            } else {
              console.log("Element not found.");
            }
          }      

        // we need here to return the page source of the navigated page
        return window.document.documentElement.outerHTML;
    } catch (error) {
        console.log(`Error loading page source: ${error.message}`);
    }
}

async function parsePageSourceToJSON(pageSource, collect, ignoreTags) {
    const { window } = new JSDOM(pageSource);
    const parsedData = parseElement(window.document.documentElement, collect, ignoreTags);
    return parsedData;
}

function parseElement(element, collect, ignoreTags) {
    const parsedData = {};

    collect = collect || [];

    parsedData.tag = element.tagName.toLowerCase();
    console.log('parsedData.tag', parsedData.tag);
    // if(ignoreTags.includes(parsedData.tag))
    // process.exit()

    if(!ignoreTags.includes(parsedData.tag)){
        parsedData.attributes = {};
        if(parsedData.tag != 'svg') {
            for (const attr of element.attributes) {
                    if(collect.length > 0 && collect.includes(attr.name)){
                        parsedData.attributes[attr.name] = attr.value;
                    } else if(collect.length == 0) {
                        parsedData.attributes[attr.name] = attr.value;
                    }

            }
        }
        parsedData.textContent = element.textContent;    

        parsedData.children = [];
        for (const childNode of element.childNodes) {
            if (childNode.nodeType === element.ELEMENT_NODE) {
                parsedData.children.push(parseElement(childNode, collect, ignoreTags));
            }
        }
    }

    return parsedData;
}

async function replaceMissing(baseUrl, pageSource) {
    try {
        const { window } = new JSDOM(pageSource);
        const document = window.document;

        // Update src attributes
        const srcElements = document.querySelectorAll('*[src]');
        srcElements.forEach(element => {
            const srcValue = element.getAttribute('src');
            if (!srcValue.startsWith('data:') &&
                !srcValue.startsWith('http') && !srcValue.startsWith('//')) {
                element.setAttribute('src', baseUrl + srcValue);
            }
        });

        // Update href attributes
        const hrefElements = document.querySelectorAll('*[href]');
        hrefElements.forEach(element => {
            const hrefValue = element.getAttribute('href');
            if (!hrefValue.startsWith('data:') &&
                !hrefValue.startsWith('http') && !hrefValue.startsWith('//')) {
                element.setAttribute('href', baseUrl + hrefValue);
            }
        });

        return document.documentElement.outerHTML;
    } catch (error) {
        console.error('Error replacing missing URLs:', error);
        return pageSource; // Return the original source if there's an error
    }
}

function removeCloudflareScripts(pageSource) {
    try {
        const { window } = new JSDOM(pageSource);
        const document = window.document;

        const scriptsToRemove = document.querySelectorAll('script[src*="static.cloudflareinsights.com"]');
        scriptsToRemove.forEach(script => {
            script.parentNode.removeChild(script);
        });

        return document.documentElement.outerHTML;
    } catch (error) {
        console.error('Error removing Cloudflare scripts:', error);
        return pageSource; // Return the original source if there's an error
    }
}

const getCSSSelectorByXPath = (xpath) => {
    // Remove any single quotes around the XPath
    xpath = xpath.replace(/^'|'$/g, '');

    // Split the XPath into parts
    const parts = xpath.split('/').filter(part => part.length > 0);

    // Convert each part of the XPath to a CSS selector
    const cssParts = parts.map(part => {
        const tag = part.split('[')[0];
        const indexMatch = part.match(/\[(\d+)\]/);

        if (indexMatch) {
            const index = parseInt(indexMatch[1]) - 1; // Convert 1-based to 0-based
            return `${tag}:nth-child(${index + 1})`;
        } else {
            return tag;
        }
    });

    // Join the CSS parts to create the final CSS selector
    const cssSelector = cssParts.join(' > ');

    return cssSelector;
};



app.get('/scraper', async (req, res) => {

    if(req.query.content == null || req.query.content == '' || req.query.content.toLowerCase() == 'json' ||
        req.query.content.toLowerCase() == 'html') {
        let pageSource = await loadPageSource(req.query.url, req.query.navigate);
        try {
            if(req.query.content.toLowerCase() == 'html'){
                const url = new URL(req.query.url);
                const baseURI = `${url.protocol}//${url.hostname}/`;

                pageSource = await replaceMissing(baseURI, pageSource);

                pageSource = removeCloudflareScripts(pageSource);

                pageSource = pageSource.replace('</body>', 
                `<script>
                const obj = {
                    updateAttributes: (element, attribute, baseUrl) => {
                        const value = element.getAttribute(attribute);
                        if (value && !value.startsWith('data:') && !value.startsWith('http')
                            && !value.startsWith('//')) {
                            element.setAttribute(attribute, baseUrl + value);
                        }
                    },
                    intervalDuration: 100,
                    emit() {
                        setInterval(obj.fetchAndUpdatePage, obj.intervalDuration)
                    },
                    async fetchAndUpdatePage() {
                        const baseURI = '${baseURI}'
                        const doc = document.documentElement;
                        const allElements = doc.querySelectorAll('*[src], *[href]');
                        allElements.forEach((element) => {
                            obj.updateAttributes(element, 'src', baseURI);
                            obj.updateAttributes(element, 'href', baseURI);
                        });
                    }
                }
                obj.emit();
                </script></body>`);

                res.set('Content-Type', 'text/html');
                res.send(Buffer.from(pageSource, 'utf8'));

            } else if(req.query.content.toLowerCase() == 'json') {

                const formattedData = await parsePageSourceToJSON(pageSource);
                res.json(formattedData);
            }
        } catch (error) {
            console.error('Error:', error);
            res.status(500).json({ error });
        }
    }
    else if(req.query.content.toLowerCase() == 'pdf' ||
            req.query.content.toLowerCase() == 'png') {
        try {
            if(req.query.content.toLowerCase() == 'pdf'){

                const portrait=true // false for landscape
                const zoom = false // true
                const print_size = false //true
                
                var pdf = await WebPdf(req.query.url,portrait,zoom,print_size)

                res.set('Content-Type', 'application/pdf');
                res.send(pdf);


            } else if(req.query.content.toLowerCase() == 'png'){

                let image = await web.capture(req.query.url)
                res.set('Content-Type', 'image/png');
                res.send(image);
            }
        } catch (error) {
            console.error('Error:', error);
            res.status(500).json({ error });
        }
    }

});

app.get('/', async (req, res) => {
    // console.log('req', req.query);

    // res.json({ success: 'Server is running' });

    res.sendFile('./public/index.html');


})


const main = async () => {

    console.log('loading...');

    await loadLlamaModules();
    initalize = 1;
    
    // await NK.xpr.start(port);
    const PORT = process.env.PORT || 3000;

    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    });

    // console.log(`Server is running on port ${PORT}`);
}

main()

const randomBetween = (min, max) => {
    return Math.random() * (max - min) + min;
}

// const OpenAI = require("openai");

// const openai = new OpenAI(process.env.OPENAI_API_KEY);

// const { LLM } = require("llama-node");

const TOKENS_MAX = 1024;
const Q = 1.618033988749895;

// async function loadFetch() {
//     try {
//         const module = await import('node-fetch');
//         fetch = module.default || module;
//     } catch (error) {
//         console.error("Failed to load module: ", error);
//     }
// }

// loadFetch();


// let Bard;

// async function loadBard() {
//     try {
//         const module = await import("bard-ai");
//         Bard = module.default;
//     } catch (error) {
//         console.error("Failed to load module: ", error);
//     }
// }

// loadBard();


const fs = require('fs');

// async function downloadModel(url, path) {
//     const response = await axios.get(url, {
//         responseType: 'stream'
//     });

//     return new Promise((resolve, reject) => {
//         const fileStream = fs.createWriteStream(path);
//         response.data.pipe(fileStream);
//         fileStream.on('finish', resolve);
//         fileStream.on('error', reject);
//     });
// }


async function downloadModel(url, path) {
    const response = await axios.get(url, {
        responseType: 'stream'
    });

    // Extract the total length of the content from the headers
    const totalLength = Number(response.headers['content-length']);

    // If content length is available, monitor progress, otherwise just download
    if (!isNaN(totalLength)) {

        let downloadTime = new Date().getTime();

        let count = 0;

        let downloadedLength = 0;
        response.data.on('data', chunk => {

            downloadedLength += chunk.length;
            const percentage = ((downloadedLength / totalLength) * 100).toFixed(2);
            const currentTime = new Date().getTime();
            const elapsedTime = (currentTime - downloadTime) / 1000;
            const estimatedTimeLeft = (totalLength - downloadedLength) / (downloadedLength / elapsedTime);
            const downloadSpeed = downloadedLength / elapsedTime;
            
            console.log(`count: ${count++}\nDownloaded ${downloadedLength} bytes out of ${totalLength} bytes (${percentage}%)\nEstimated time left: ${estimatedTimeLeft.toFixed(2)} seconds\nEstimated time left: ${(estimatedTimeLeft / 60).toFixed(2)} minutes\nDownload speed: ${downloadSpeed.toFixed(2)} bytes per second\nDownload speed: ${(downloadSpeed / 1024).toFixed(2)} kilobytes per second\nDownload speed: ${(downloadSpeed / 1024 / 1024).toFixed(2)} megabytes per second\n\n`);

        });
    } else {
        console.log('Downloading data...');
    }

    return new Promise((resolve, reject) => {
        const fileStream = fs.createWriteStream(path);
        response.data.pipe(fileStream);
        fileStream.on('finish', resolve);
        fileStream.on('error', reject);
    });
}



async function fileExists(_filePath) {
    try {
        await fsPromises.access(_filePath, fs.constants.R_OK);
        return true;
    } catch (error) {
        return false;
    }
}



// let LlamaModel, LlamaGrammar, LlamaContext, LlamaChatSession;

// let model;

// let context;
// let session;


async function loadLlamaModules() {
    const modelURL = 
     'https://huggingface.co/TheBloke/CodeLlama-34B-Python-GGUF/resolve/main/codellama-34b-python.Q6_K.gguf';
    // 'https://huggingface.co/TheBloke/CodeLlama-7B-Python-GGUF/resolve/main/codellama-7b-python.Q2_K.gguf';
    
    
    // 'https://huggingface.co/TheBloke/CodeLlama-34B-Python-GGUF/resolve/main/codellama-34b-python.Q2_K.gguf'
    // 'https://huggingface.co/TheBloke/CodeLlama-34B-Python-GGUF/resolve/main/codellama-34b-python.Q4_K_M.gguf'
    
    // 'https://huggingface.co/TheBloke/CodeLlama-13B-Python-GGUF/resolve/main/codellama-13b-python.Q6_K.gguf'
    // 'https://huggingface.co/TheBloke/CodeLlama-13B-Python-GGUF/resolve/main/codellama-13b-python.Q2_K.gguf'

    // 'https://huggingface.co/TheBloke/CodeLlama-7B-Python-GGUF/resolve/main/codellama-7b-python.Q4_K_M.gguf'
    // 'https://huggingface.co/TheBloke/CodeLlama-7B-Python-GGUF/resolve/main/codellama-7b-python.Q6_K.gguf'
    // 'https://huggingface.co/TheBloke/CodeLlama-7B-Python-GGUF/resolve/main/codellama-7b-python.Q2_K.gguf';
    // filePath = '/var/data/model.gguf';
    // const filePath = './src/ai/model.gguf';


    let LlamaModel, LlamaGrammar, LlamaContext, LlamaChatSession;

    let model;
    
    let session = null;
    let context = null;
    try {
        // Download the model
        if(initalize == 0){
            if(await fileExists(filePath) == false) {
                await downloadModel(modelURL, filePath);
            }
        }

        const module = await import("node-llama-cpp");
        LlamaModel = module.LlamaModel;
        LlamaGrammar = module.LlamaGrammar;
        LlamaContext = module.LlamaContext;
        LlamaChatSession = module.LlamaChatSession;

        model = new LlamaModel({ 
            modelPath: filePath,
            // enableLogging: true,
            // nCtx: 1024,
            // seed: 0,
            // f16Kv: false,
            // logitsAll: false,
            // vocabOnly: false,
            // useMlock: false,
            // embedding: false,
            // useMmap: true,
            // nGpuLayers: 0 
        });

        context = new LlamaContext({
            model,
            // mmap: false,
            // gpu: false,
            // maxTokens: 64,
            // batchSize: 4
        });

        session = new LlamaChatSession({ context });
    } catch (error) {
        console.error("Failed to load module: ", error);
    }

    return {session, context};

    // return { model, context, session };
}



// let LlamaModel, LlamaGrammar, LlamaContext, LlamaChatSession;
// let model, context;
// let session;

// async function downloadModel(url) {
//     const response = await axios.get(url, { responseType: 'arraybuffer' });
//     return new Buffer(response.data);
// }

// async function loadLlamaModules() {
//     const modelURL = 'https://huggingface.co/TheBloke/CodeLlama-7B-Python-GGUF/resolve/main/codellama-7b-python.Q2_K.gguf';

//     try {
//         const modelBuffer = await downloadModel(modelURL);

//         const module = await import("node-llama-cpp");
//         LlamaModel = module.LlamaModel;
//         LlamaGrammar = module.LlamaGrammar;
//         LlamaContext = module.LlamaContext;
//         LlamaChatSession = module.LlamaChatSession;

//         model = new LlamaModel({ modelBuffer });  // This is speculative!
//         context = new LlamaContext({
//             model,
//             mmap: false,
//             gpu: false,
//             maxTokens: 8,
//             batchSize: 1
//         });

//         session = new LlamaChatSession({ context });
//     } catch (error) {
//         console.error("Failed to load module: ", error);
//     }

//     return { model, context, session };
// }




// let LlamaModel, LlamaGrammar, LlamaContext, LlamaChatSession;

// let model, context;

// let session;

// async function loadLlamaModules() {

//     // https://huggingface.co/TheBloke/CodeLlama-7B-Python-GGUF/resolve/main/codellama-7b-python.Q2_K.gguf
    
//     let filePath = ''
//     // download link and store it with fs in ./src/ai/...

    
//     try {
//         const module = await import("node-llama-cpp");
//         LlamaModel = module.LlamaModel;
//         LlamaGrammar = module.LlamaGrammar;
//         LlamaContext = module.LlamaContext;
//         LlamaChatSession = module.LlamaChatSession;



//      model = new LlamaModel({
//         modelPath: filePath
//     })
//     // const grammar = await LlamaGrammar.getFor('json'); // contentType.split('/')[1]
//      context = new LlamaContext({
//         model,
//         // grammar,
//         mmap: false,
//         gpu: false,
//         maxTokens: 8,
//         batchSize: 1
//     });

//     session = new LlamaChatSession({context});

//     } catch (error) {
//         console.error("Failed to load module: ", error);
//     }
// }



// loadLlamaModules();
// await loadLlamaModules();



async function fetchGptResponse(prompt, contentType, session, context) {


    if(initalize == 0 || session == '' || session == undefined || session == null || session == 'undefined') {
    // if(await fileExists(filePath) == false) {

    // if(await fileExists(filePath) == false) {
        await loadLlamaModules();
        initalize = 1;
    }

    // const model = new LlamaModel({
    //     modelPath: './src/ai/codellama-7b-python.Q2_K.gguf'
    // })
    // // const grammar = await LlamaGrammar.getFor(contentType.split('/')[1]);
    // const context = new LlamaContext({
    //     model,
    //     // grammar,
    //   //   mmap: false,
    //   //   gpu: false,
    //   //   maxTokens: 64,
    //   //   batchSize: 1
    // });
    // const session = new LlamaChatSession({context});
    


    // const params = {
    //     nThreads: 4,
    //     nTokPredict: 2048,
    //     topK: 40,
    //     topP: 0.1,
    //     temp: 0.2,
    //     repeatPenalty: 1,
    //     prompt,
    // };

    // return await session.createCompletion(params);

    

    return await session.prompt(prompt, {
        nThreads: 8,
        // repeatPenalty: 1,
        maxTokens: context.getContextSize(),
    });




    // import Bard from "bard-ai";

    // const COOKIE = 'awhwhJJRcDWy6mC8qX5xYW63_EfL6xgbDJAYyvwtEGulKK0WipMmpABONf5LAgLL6LFZdA.';

    // let myBard = new Bard(COOKIE);
    // let response = await myBard.ask(prompt);

    // console.log(response);

    // return response;


    // let responseCompletion = false
    // let response = ''

    // import("llama-node/dist/llm/llama-cpp.js").then(async ({ LLamaCpp }) => {
        
    //     const path = require("path");
        
    //     const model = path.resolve(process.cwd(), "./src/ai/ggml-vicuna-7b-1.1-q5_1.bin");
    //     const llama = new LLM(LLamaCpp);
    //     const config = {
    //         modelPath: model,
    //         enableLogging: true,
    //         nCtx: TOKENS_MAX/2,
    //         seed: 0,
    //         f16Kv: false,
    //         logitsAll: false,
    //         vocabOnly: false,
    //         useMlock: false,
    //         embedding: false,
    //         useMmap: true,
    //         nGpuLayers: 0
    //     };
        
    //     await llama.load(config);


    //     const params = {
    //         prompt,
    //         nThreads: 4,
    //         nTokPredict: 2048,
    //         numPredict: 128,
    //         temperature: 0.2,
    //         topP: 1,
    //         topK: 40,
    //         repeatPenalty: 1,
    //         repeatLastN: 64,
    //         seed: 0,
    //         feedPrompt: true,
    //     };
        
        
    //     await llama.createCompletion(
    //         params
            
    //         // {
    //         //     nThreads: 4,
    //         //     nTokPredict: TOKENS_MAX - prompt.length,
    //         //     topK: 40,
    //         //     topP: 0.1,
    //         //     temp: 0.2,
    //         //     repeatPenalty: 1,
    //         //     prompt,
    //         // }
            
    //         , (response) => {
    //         process.stdout.write(response.token);
        
    //         response += response.token;
    //     });

    //     responseCompletion = true
  
    
    // }).catch(error => {
    //     // Handle any errors that occurred during the import
    //     console.log(error);
    // });



    // while(!responseCompletion) {
    //     await new Promise(r => setTimeout(r, 1000));
    // }

    // return response;






    // let output = null
    // // GPT.on('ready', async () => {
    // //     console.log('GPT-4 ready');
    //     output = await GPT.ask(prompt);
    //     console.log(output);
    // // });

    // // GPT.on('data', async () => {
    // //     console.log('GPT-4 data');
    // //     output = await GPT.ask(prompt);
    // //     console.log(output);
    // // });

    // while(output == null) {
    //     await new Promise(r => setTimeout(r, 1000));
    // }

    // // GPT.on('ready', async () => {
    // return output;
    // // });





//     import openai
// openai.api_base = "http://localhost:4891/v1"

// openai.api_key = "not needed for a local LLM"


// def test_completion():
//     model = "gpt4all-j-v1.3-groovy"
//     prompt = "Who is Michael Jordan?"
//     response = openai.Completion.create(
//         model=model,
//         prompt=prompt,
//         max_tokens=50,
//         temperature=0.28,
//         top_p=0.95,
//         n=1,
//         echo=True,
//         stream=False
//     )
//     assert len(response['choices'][0]['text']) > len(prompt)
//     print(response)











//     const openai = new OpenAI()
//     // openai.api_base = "https://turbogpte.onrender.com/v1"




//     const engine = "text-davinci-003";
// // "gpt4all-j-v1.3-groovy"
//     // "text-davinci-003";
//     // "gpt-3.5-turbo-instruct"

//     try {

//         let options = {
//             model: engine,
//             prompt,
//             max_tokens: TOKENS_MAX - prompt.length,

//             n: 1,
//             best_of: 3,

//         };

//         if(contentType == 'application/json') {
//             options.top_p = 0;

//             // options = {
//             //     ...options,
//             //     top_p: 0,
//             // }
//         } else {
//             options.temperature = randomBetween(1.0, 1.2);

//             // options = {
//             //     ...options,
//             //     temperature: randomBetween(1.0, 1.2),
//             // }
//         }
        
//         let gptResponse = ''
        
//         try {
//             console.log('GPT-3 request:', options);

//             gptResponse =
//             await openai.completions.create(options);

//             console.log('GPT-3 response:', gptResponse);

//             const choices = gptResponse ? gptResponse.choices : [];
//             let response = ''
//             for(const choice of choices) {
//                     response += choice.text;
//             }
//             return response;
//         } catch (error) {
//             console.error('Error fetching GPT-3 response:', error);
//             return '';
//         }
        
//     } catch (error) {
//         console.error('Error fetching GPT-3 response:', error);
//         return '';
//     }
}

const sanatizeNCheckContentType = (contentType) => {
    const allowedContentTypes = [
        'text/html',
        'application/json',
        'text/css',
        'application/xml',
        'image/svg',
        'text/plain',
        'text/markdown',
        'text/csv',
        'application/javascript',
        'application/python',
        'application/java',
        'application/php',
        'application/sql',
        'application/ruby',
        'application/c',
        'application/go',
        'application/rust',
        'application/typescript',
        'application/kotlin',
        'application/swift',
        'application/scala',
        'application/clojure',
        'application/haskell',
        'application/erlang',
        'application/dart',
        'application/lisp',
        'application/perl',
        'application/lua',
        'application/r',
        'application/matlab',
        'application/fortran',
        'application/assembly',
      ];

    if(!contentType || contentType.length == 0) return 'text/html';

    if(allowedContentTypes.includes(contentType.toLowerCase())) return contentType.toLowerCase();
 
    else return 'text/html';
}

const keepSelection = async (pageSource, cssQuery) => {
    try {
        const { window } = new JSDOM(pageSource);
        const document = window.document;

        // Create a Set to keep track of elements that should be kept
        const elementsToKeep = new Set();
        
        // Add each element that matches the query (and its parents) to the Set
        const selectedElements = document.querySelectorAll(cssQuery);
        selectedElements.forEach(el => {
            let current = el;
            while (current) {
                elementsToKeep.add(current);
                current = current.parentNode;
            }
            
            // Also add all descendants of each selected element
            const descendants = el.querySelectorAll('*');
            descendants.forEach(descendant => elementsToKeep.add(descendant));
        });
        
        // Remove elements not in the Set, while child elements of elementsToKeep are kept
        const allElements = Array.from(document.querySelectorAll('*'));
        for (const element of allElements) {
            if (!elementsToKeep.has(element) && element.parentNode) {
                element.parentNode.removeChild(element);
            }
        }

        // Return the modified HTML
        return document.documentElement.outerHTML;
    } catch (error) {
        console.error('Error keeping selection:', error);
        return pageSource; // Return the original source if there's an error
    }
}

const getAllAttributes = (node) => {
    let markdown = '';

    const { tag, attributes, textContent, children } = node

    if(attributes) {
        for(const attribute in attributes) {
            markdown += ` ${attribute}="${attributes[attribute]}"`
        }
    }

    if(children && children.length > 0) {
        for(const child of children) {
            markdown += getAllAttributes(child);
        }
    }

    return markdown;
}

const markdownFromJSON = async (node) => {
    let markdown = '';

    const { tag, attributes, textContent, children } = node

    console.log('node', node);
    
    // collect from attributes img src and a tags href and html textContent
    if(tag == 'img') {
        markdown += `![${attributes.alt}](${attributes.src})\n`
    }
    else if(tag == 'a') {
        markdown += `[${textContent}](${attributes.href})\n`
    }
    else if(
        tag == 'h1' || tag == 'h2' || tag == 'h3' || tag == 'h4' || tag == 'h5' || tag == 'h6' ||
        tag == 'p' || tag == 'span' || tag == 'div' || tag == 'li' || tag == 'ul' || tag == 'ol' ||
        tag == 'b' || tag == 'i' || tag == 'u' || tag == 'em' || tag == 'strong' || tag == 'code' ||
        tag == 'pre' || tag == 'blockquote' || tag == 'br' || tag == 'hr' || tag == 'table' ||
        tag == 'thead' || tag == 'tbody' || tag == 'tr' || tag == 'th' || tag == 'td'
    ) {
        markdown += textContent + '\n'
    }
    else if(tag == 'iframe') {
        markdown += `![${attributes.title}](${attributes.src})\n`
    }
    else if(tag == 'video') {
        markdown += `![${attributes.title}](${attributes.poster})\n`
    }
    else if(tag == 'audio') {
        markdown += `![${attributes.title}](${attributes.src})\n`
    }
    else if(tag == 'svg') {
        markdown += textContent + '\n'
        // getAllAttributes(node)
    } else {
        // if node has no children and is not a tag that we know
        if(!children || children.length == 0)
        if(textContent && textContent.length > 0) {

            markdown += textContent + '\n'
        }
    }

    if(children && children.length > 0) {
        for(const child of children) {
            markdown += await markdownFromJSON(child);
        }
    }

    return markdown;

}

const concatJSON = async (jsons) => {
    if (!Array.isArray(jsons)) {
      throw new Error('Input must be an array');
    }
  
    const result = {};
  
    for (const json of jsons) {
      if (typeof json !== 'object' || json === null || Array.isArray(json)) {
        console.log('All elements in the array must be JSON-serializable objects');
        continue;
      }
      
      for (const key in json) {
        if (Object.prototype.hasOwnProperty.call(json, key)) {
          result[key] = json[key];
        }
      }
    }
  
    return JSON.stringify(result);
}

app.get('/render-description', async (req, res) => {
    const prompt = decodeURIComponent(req.query.description);
    const contentType = 
    sanatizeNCheckContentType(decodeURIComponent(req.query.contentType));

    const referenceUrl = decodeURIComponent(req.query.referenceUrl);
    const referenceData = decodeURIComponent(req.query.referenceData);
    
    let ignoreTags = decodeURIComponent(req.query.ignoreTags).split(',');
    ignoreTags = ignoreTags == null || ignoreTags == '' || ignoreTags == undefined || ignoreTags == 'undefined' ? [] : ignoreTags;
    
    console.log('prompt', prompt);
    console.log('contentType', contentType);
    console.log('referenceUrl', referenceUrl);
    console.log('referenceData', referenceData);
    
    console.log('ignoreTags', ignoreTags);

    let formattedDataString = '';
    if(req.query.referenceUrl && req.query.referenceUrl.length > 0) {
        try {
            let pageSource = await loadPageSource(referenceUrl, req.query.navigate);

            pageSource = pageSource.replace(/n\(.*?\)/g, '').replace(/;case"emoji":return!/g, '');
            const filtered = req.query.cssQuery ?
            await keepSelection(pageSource, getCSSSelectorByXPath(req.query.cssQuery)) :
            pageSource;

            console.log('filtered', filtered);

            if(!filtered) {
                res.status(500).json({ error: 'Invalid cssQuery' });
                return;
            }
            
            const collect = req.query.attributeNames ? req.query.attributeNames.split(',') : [];

            console.log('collect', collect);

            let formattedData = await parsePageSourceToJSON(filtered, collect, ignoreTags);
            console.log('formattedData', formattedData);
            // process.exit()

            const markdown = await markdownFromJSON(formattedData);
            // getAllAttributes(formattedData)

            console.log('markdown', markdown);

            formattedDataString = (markdown) + ' ';
        } catch (error) {
            console.log(error);
            res.status(500).json({ error: 'Invalid referenceUrl' });
            return;
        }
    }
    if(referenceData && referenceData.length > 0) {
        formattedDataString += decodeURIComponent(referenceData);
    }

    const extraPrompt = formattedDataString != null && 
    formattedDataString != '' && 
    formattedDataString != undefined && 
    formattedDataString != 'undefined' &&
    formattedDataString.length > 0 ? `${formattedDataString}` : ''

    const resultPrompt = prompt
    // `Generate ${
    //     contentType.split('/')[1].toLowerCase() == 'json' ? 
    //     'JSON' : 
    //     contentType.split('/')[0].toLowerCase() == 'application' ?
    //     contentType.split('/')[1].toLowerCase() :
    //     contentType.split('/')[0].toLowerCase() +" "+ contentType.split('/')[1].toLowerCase()
    // } code, ${prompt}`;

    const dataFillString = ''
    // ` from this data: \n`

    const increment = parseInt(TOKENS_MAX/Q) /*- resultPrompt.length*/ - (dataFillString).length
    let response = '';

    if(contentType == 'application/json') {
        response = '{}';
    }

    const shiftIncrement = 0;//parseInt(increment * 0.1)

    const {session, context} = await loadLlamaModules()

    let countChunks = 0;
    let totalChunks = Math.ceil(extraPrompt.length / (increment - shiftIncrement));

    let arrayCount = 0;
    let length = 0
    for(; length == 0 || length < extraPrompt.length; length += increment - shiftIncrement) {

        let resultPromptTemp = resultPrompt + `\nDATA chunk `
        // let resultPromptTemp = length == 0 ? resultPrompt : `DATA chunk `

        // if(length > 0) {
            resultPromptTemp += `(${++countChunks}/${totalChunks}):\n`
        // }

        // if(length > 0) {
            resultPromptTemp +=
            extraPrompt.length > 0 ?
            dataFillString +
            extraPrompt.substr(length, increment) : ''
        // }

        // resultPromptTemp = resultPromptTemp
        // .replace(/\s+/g, ' ').trim();

        console.log('resultPromptTemp', resultPromptTemp, resultPromptTemp.length);
        // process.exit()

        if(resultPromptTemp.length > parseInt(TOKENS_MAX*Q)) {
            res.status(500).json({ error: 'Prompt is too long' });  
            return;  
        }
        else {

            let code = ''

            try {
                code =
                await fetchGptResponse(
                    resultPromptTemp,
                    contentType,
                    session,
                    context
                );

                console.log('code >>>>>>>>>>>> ', code);

                if(contentType == 'application/json') {

                    console.log('code', code);

                    
                    function extractStructure(code) {
                        // Checks if code contains the necessary characters for extraction
                        if (typeof code !== 'string' || (!code.includes('{') && !code.includes('[') && !code.includes(','))) {
                        return '{}';
                        }
                        
                        let startIndex, endIndex;
                        
                        let arrayStart = code.indexOf('[');
                        let curlyStart = code.indexOf('{');
                        let commaIndex = code.lastIndexOf(',');
                        
                        if (arrayStart < curlyStart && arrayStart != -1) {
                        startIndex = arrayStart;
                        endIndex = (code.lastIndexOf(']') > code.lastIndexOf('}')) ? code.lastIndexOf(']') : code.lastIndexOf('}') !== -1 ? code.lastIndexOf('}') : commaIndex !== -1 ? commaIndex : code.length;
                        } else if (curlyStart !== -1) {
                        startIndex = curlyStart;
                        endIndex = code.lastIndexOf('}') !== -1 ? code.lastIndexOf('}') : commaIndex !== -1 ? commaIndex : code.length;
                        } else {
                        startIndex = 0;
                        endIndex = commaIndex;
                        }
                    
                        // If startIndex is -1, set it to 0
                        if (startIndex === -1) {
                        startIndex = 0;
                        }
                        
                        // If endIndex is -1, take the string till the end
                        if (endIndex === -1) {
                        return code.slice(startIndex);
                        }
                        
                        return code.slice(startIndex, endIndex + 1);
                    }
                    

                    let trimCode = extractStructure(code);

                    console.log('trimCode', trimCode);

                    const sanitizedJsonString = (brokenJson, possibleJsonEnds) => {
                        try {
                            return JSON.parse(brokenJson);
                        } catch (e) {
                            let sanitizedJson = brokenJson;
                            
                            for(const possibleJsonEnd of possibleJsonEnds) {

                                try {
                                    return JSON.parse(sanitizedJson + possibleJsonEnd);
                                } catch (e) {
                                    console.log('e', e);
                                }
                            }
                            return "{}";

                        }
                    }

                    const possibleJsonEnds = [
                    '}', '}]', '}}', ']}', ']'
                    ]

                    trimCode =
                    sanitizedJsonString(trimCode, possibleJsonEnds)
                    
                    if(Array.isArray(trimCode)) {
                        trimCode = {
                            [arrayCount] : trimCode
                        }
                        arrayCount++;
                    }
                    
                    console.log('trimCode', trimCode);

                    try {
                        response = await concatJSON([JSON.parse(response), trimCode]);

                        console.log('response', response);
                    } catch (error) {
                        console.log('error', error);
                    }

                } else {
                    response = response + code;
                }

            } catch (error) {
                console.log('error', error);
            }


        }

        console.log('response', response);
    }

        
    if(contentType == 'application/json') {

        // reproces the json to remove repeated keys and keep only the last one while keeping the response homogeneous  
        const redisgnJson = async (json) => {
            try {
                const parsedJson = JSON.parse(json);
                const keys = Object.keys(parsedJson);
                const values = Object.values(parsedJson);
                const newJson = {};
                for(let i = 0; i < keys.length; i++) {
                    newJson[keys[i]] = values[i];
                }
                return JSON.stringify(newJson);
            } catch (error) {
                return json;
            }
        }
        response = await redisgnJson(response); 
        try {
            const json = JSON.parse(response);
            res.json(json);
        }
        catch(e) {
            res.status(500).json({ error: 'Invalid JSON' });
        }
    } 
    else if(contentType == 'image/svg') {
        res.set('Content-Type', `image/svg+xml`);

        if(!response.includes('xmlns')) {
            // parse the existing svg attributes and add xmlns
            const svgAttributes = response.match(/<svg[^>]*>/g);
            if(svgAttributes && svgAttributes.length > 0) {
                const lastSvgAttributes = svgAttributes[svgAttributes.length - 1];
                response = response.replace(/<svg[^>]*>/g, lastSvgAttributes + ' xmlns="http://www.w3.org/2000/svg"');
            }       
        }

        // check for repeated svg attributes and keep only the last one
        const svgAttributes = response.match(/<svg[^>]*>/g);
        if(svgAttributes && svgAttributes.length > 0) {
            const lastSvgAttributes = svgAttributes[svgAttributes.length - 1];
            response = response.replace(/<svg[^>]*>/g, lastSvgAttributes);
        }


        res.send(response);
    }
    else {
        res.set('Content-Type', contentType);
        res.send(Buffer.from(response, 'utf8'));
    }
    
});

module.exports = app;


// http://localhost:3000/render-description?contentType=&description=&referenceData=&referenceUrl=&cssQuery=&attributeNames=


// http://localhost:3000/render-description?contentType=text/plain&description=translate%20and%20summarize%20french%20text%20to%20english&referenceUrl=https://fr.wikipedia.org/wiki/Hasard&cssQuery=/html/body/div%5B2%5D/div/div%5B3%5D/main/div%5B3%5D

// http://localhost:3000/render-description?contentType=text/plain&description=list%20coin%20names,%20image%20src%20urls%20and%20prices&referenceUrl=https://coinmarketcap.com&cssQuery=/html/body/div[1]/div[2]/div[1]/div[2]/div/div[1]/div[4]/table/tbody/tr&attributeNames=class,display,flex

// http://localhost:3000/render-description?contentType=application/json&description=list%20coin%20names,%20image%20src%20urls%20and%20prices&referenceUrl=https://coinmarketcap.com&cssQuery=/html/body/div[1]/div[2]/div[1]/div[2]/div/div[1]/div[4]/table/tbody/tr[1]

// http://localhost:3000/render-description?contentType=application/json&description=extract%20coin%20names%20images%20and%20prices&referenceUrl=https://coinmarketcap.com&cssQuery=/html/body/div[1]/div[2]/div[1]/div[2]/div/div[1]/div[4]/table/tbody/tr[1]


// http://localhost:3000/render-description?contentType=text/plain&description=in%20the%20options%20const%20gptResponse%20=%20await%20openai.completions.create(options)%20which%20ones%20from%20the%20list%20can%20i%20use%20instead%20of%20text-davinci-003&referenceUrl=https://platform.openai.com/account/rate-limits

// http://localhost:3000/render-description?contentType=image/svg&description=red%20heart&referenceUrl=https://www.svgrepo.com/show/525363/heart-angle.svg

// http://localhost:3000/render-description?contentType=image/svg&description=resize%20red&referenceUrl=https://www.svgrepo.com/show/525363/heart-angle.svg

// http://localhost:3000/render-description?contentType=&description=&referenceData=

// http://localhost:3000/render-description?contentType=image/svg&description=fit%20and%20overlay%20svg%20contents&referenceData=%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%20width=%22800px%22%20height=%22800px%22%20viewBox=%220%200%2024%2024%22%20fill=%22none%22%3Ev%3Cpath%20d=%22M8.10627%2018.2468C5.29819%2016.0833%202%2013.5422%202%209.1371C2%204.27416%207.50016%200.825464%2012%205.50063L14%207.49928C14.2929%207.79212%2014.7678%207.79203%2015.0607%207.49908C15.3535%207.20614%2015.3534%206.73127%2015.0605%206.43843L13.1285%204.50712C17.3685%201.40309%2022%204.67465%2022%209.1371C22%2013.5422%2018.7018%2016.0833%2015.8937%2018.2468C15.6019%2018.4717%2015.3153%2018.6925%2015.0383%2018.9109C14%2019.7294%2013%2020.5%2012%2020.5C11%2020.5%2010%2019.7294%208.96173%2018.9109C8.68471%2018.6925%208.39814%2018.4717%208.10627%2018.2468Z%22%20fill=%22red%22/%3E%3C/svg%3E%20%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%20fill=%22black%22%20width=%22800px%22%20height=%22800px%22%20viewBox=%220%200%2032%2032%22%3E%3Cpath%20d=%22M16%2015.503A5.041%205.041%200%201%200%2016%205.42a5.041%205.041%200%200%200%200%2010.083zm0%202.215c-6.703%200-11%203.699-11%205.5v3.363h22v-3.363c0-2.178-4.068-5.5-11-5.5z%22/%3E%3C/svg%3E


// http://localhost:3000/render-description?contentType=text/html&description=summary&referenceUrl=https://www.bbc.com/news/world-asia-66737052&ignoreTags=head,script,style

// http://localhost:3000/render-description?contentType=text/html&description=summary&referenceUrl=https://www.state.gov/countries-areas/lebanon/&ignoreTags=head,script,style







// https://rapid-xbzq.onrender.com/render-description/?contentType=application/json&description=Can%20you%20organize%20the%20DATA%20passed%20in%20chunks%20into%20a%20JSON%20object?&referenceUrl=https://coinmarketcap.com&cssQuery=/html/body/div%5B1%5D/div%5B2%5D/div%5B1%5D/div%5B2%5D/div/div%5B1%5D/div%5B4%5D/table/tbody/tr%5B1%5D

// https://rapid-xbzq.onrender.com/render-description?contentType=text/html&description=Can%20you%20summarize%20the%20DATA%20passed%20in%20chunks%20into%20an%20HTML20response?&referenceUrl=https://www.bbc.com/news/world-asia-66737052&ignoreTags=head,script,style