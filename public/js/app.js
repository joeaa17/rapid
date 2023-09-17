const action = document.querySelector('#prompt')
const url = document.querySelector('#url')
const data = document.querySelector('#data')
const contentType = document.querySelector('#contentType')

let _prompt = ''
let _url = ''
let _data = ''
let _contentType = ''

const promptResult = document.querySelector('#promptResult')
let _promptResult = {}

const getfile = document.querySelector('#getFile')

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
        url: _url,
        data: _data,
        contentType: _contentType
    }
    const resposne = await fetch('/get-file', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    })
    
    const file = await resposne.blob()
    const fileURL = URL.createObjectURL(file)

    window.open(fileURL, '_blank')
})

const openTab = (tab) => {
    if(tab === 'url') {
        document.querySelector('#tab-url').style.display = 'block'
        document.querySelector('#tab-data').style.display = 'none'
    } else if(tab === 'data') {
        document.querySelector('#tab-url').style.display = 'none'
        document.querySelector('#tab-data').style.display = 'block'
    }
}