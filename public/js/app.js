const action = document.querySelector('#prompt')
const url = document.querySelector('#url')
const data = document.querySelector('#data')
const contentType = document.querySelector('#contentType')

const urlBtn = document.querySelector('.tab-url')
const dataBtn = document.querySelector('.tab-data')

let _prompt = ''
let _url = ''
let _data = ''
let _contentType = ''

const promptResult = document.querySelector('#promptResult')
let _promptResult = {}

const getfile = document.querySelector('#getFile')

let processing = 'url'

action.addEventListener('change', (e) => {
    _prompt = e.target.value
    _promptResult['prompt'] = _prompt
    promptResult.innerHTML = JSON.stringify(_promptResult)
})
url.addEventListener('change', (e) => {
    _url = e.target.value
    _promptResult['url'] = _url
    promptResult.innerHTML = JSON.stringify(_promptResult)

})
data.addEventListener('change', (e) => {
    _data = e.target.value
    _promptResult['data'] = _data
    promptResult.innerHTML = JSON.stringify(_promptResult)
})
contentType.addEventListener('change', (e) => {
    _contentType = e.target.value
    _promptResult['contentType'] = _contentType
    promptResult.innerHTML = JSON.stringify(_promptResult)
})
getfile.addEventListener('click', async (e) => {

    e.preventDefault()
    const data = {
        prompt: _prompt,
        // url: _url,
        // data: _data,
        contentType: _contentType
    }

    if(processing === 'url') {
        data['url'] = _url
    } else if(processing === 'data') {
        data['data'] = _data
    }

    try {
        const response = await fetch('/get-file', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            throw new Error('Network response was not ok');
        }

        // Assuming the response is JSON; you can use response.text() or response.blob() as needed.
        const jsonData = await response.json();

        console.log(jsonData);

        promptResult.innerHTML = `<a href="${jsonData.file}" target="_blank"> >>> File <<< </a>`

    } catch (error) {
        console.error("There was a problem with the fetch operation:", error);
    }
    
})

const openTab = (tab) => {
    if(tab === 'url') {
        document.querySelector('#url').style.display = 'block'
        document.querySelector('#data').style.display = 'none'

        if(!document.querySelector('.tab-url').classList.contains('active')) {
            document.querySelector('.tab-url').classList.add('active')
            document.querySelector('.tab-data').classList.remove('active')
        }
        
        processing = 'url'

    } else if(tab === 'data') {
        document.querySelector('#url').style.display = 'none'
        document.querySelector('#data').style.display = 'block'

        if(!document.querySelector('.tab-data').classList.contains('active')) {
            document.querySelector('.tab-data').classList.add('active')
            document.querySelector('.tab-url').classList.remove('active')
        }

        processing = 'data'
    }
}

openTab('url')

urlBtn.addEventListener('click', (e) => {
    openTab('url')
})

dataBtn.addEventListener('click', (e) => {
    openTab('data')
})
