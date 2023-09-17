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

    promptResult.innerHTML = `<a href="${fileURL}" target="_blank">${fileURL}</a>`
    // window.open(fileURL, '_blank')
})

const openTab = (tab) => {
    if(tab === 'url') {
        document.querySelector('#url').style.display = 'block'
        document.querySelector('#data').style.display = 'none'

        if(!document.querySelector('.tab-url').classList.contains('active')) {
            document.querySelector('.tab-url').classList.add('active')
            document.querySelector('.tab-data').classList.remove('active')
        }
        
    } else if(tab === 'data') {
        document.querySelector('#url').style.display = 'none'
        document.querySelector('#data').style.display = 'block'

        if(!document.querySelector('.tab-data').classList.contains('active')) {
            document.querySelector('.tab-data').classList.add('active')
            document.querySelector('.tab-url').classList.remove('active')
        }
    }
}

openTab('url')