import { EdColor } from './ed-color'
import { mscConfirm, mscPrompt } from 'medium-style-confirm'
import ColorPicker from 'simple-color-picker'

const NEED_BG_VERSION = 18 // minimum version of bg script we need

let bgPage = null

//     cpicker elements
let cpicker: ColorPicker | null = null
let cpicker_input = null

ready(init) // call init when ready

/**
 * Call function when document is ready
 *
 * @param {function} fn function to call when document is ready
 */
function ready(fn: () => void) {
    if (document.readyState != 'loading') {
        fn()
    } else {
        document.addEventListener('DOMContentLoaded', fn)
    }
}

/**
 * Init of all things needed in popup
 */
function init() {
    console.group('popup init')
    console.info('document ready')

    initTabs()
    initExternalLinks()

    console.info('getting background page')
    chrome.runtime.getBackgroundPage((backgroundPage) => {
        gotBgPage(backgroundPage)
    })

    console.groupEnd()

}
/**
 * Init links on tabs
 */
function initTabs() {
    const tabs = document.getElementsByClassName('ed-tab') as HTMLCollectionOf<HTMLElement>

    for (let n of tabs) {
        n.onclick = () => {
            switchTab(n.id)
        }
    }


    console.info('tabs initialized')
}

/**
 * Init function which activates external links.
 *
 * External link is one with class set to 'ed-external' and data-url
 * attribute present.
 *
 * Because we are using this from popup, we can't use simple
 * href attribute, we will create new tab with help of chrome api.
 */

function initExternalLink(n: HTMLLinkElement) {
    if (n.dataset.url) {
        n.onclick = () => {
            chrome.tabs.create({
                url: n.dataset.url,
            })
        }
    }
}
function initExternalLinks() {
    for (let n of document.getElementsByClassName('ed-external') as HTMLCollectionOf<HTMLLinkElement>) {
        initExternalLink(n)
    }
    console.info('external links initialized')
}

/**
 * Callback - second phase of popup initialization after we got
 * connection to background page
 *
 * @param {object} backgroundPage remote object for background page
 */
function gotBgPage(backgroundPage: Window) {
    console.group('popup init phase 2')
    bgPage = backgroundPage
    console.info(`Connected to background page version ${bgPage.bg.version}`)

    // reload background if we need new version
    if (bgPage.bg.version === undefined || bgPage.bg.version < NEED_BG_VERSION) {
        console.warn(
            `Background page reload. Current version: ${bgPage.bg.version}, need version: ${NEED_BG_VERSION}`,
        )
        chrome.runtime.sendMessage({
            type: 'reload-background',
        })
        setTimeout(bgPageReady, 1000)
    } else {
        bgPageReady()
    }

    console.groupEnd()
}

function bgPageReady() {
    // init pick button with selected tab
    chrome.tabs.query({ active: true, currentWindow: true }, ((tabs: [chrome.tabs.Tab]) => {
        initPickButton(tabs[0])
    }))

}

/**
 * Add Pick Button with enabled or disabled state and appropriate message
 *
 */

function pickButton(tab: chrome.tabs.Tab, enabled: boolean, message = '') {
    let pick_el = document.getElementById('pick')
    if (enabled) {
        pick_el.onclick = () => {
            bgPage.bg.useTab(tab)
            bgPage.bg.activate()
            window.close()
        }
    } else {
        let message_el = document.getElementById('pick-message')
        message_el.innerHTML = `<h3 class="normal">&#128542; Whoops. Can't pick from this page</h3><p class="lh-copy">${message}</p>`
        message_el.style.display = 'block'
        pick_el.style.display = 'none'
    }
}

/**
 * Callback - Init pick button if it is possible
 *
 * We need to check if we are not on one of special pages:
 * - protocol starts with 'chrome'
 * - chrome webstore
 * - local page
 *
 */
function initPickButton(tab: chrome.tabs.Tab) {
    // special chrome pages
    if (tab.url === undefined || tab.url.indexOf('chrome') == 0) {
        pickButton(
            tab,
            false,
            "Chrome doesn't allow <i>extensions</i> to play with special Chrome pages like this one. <pre>chrome://...</pre>",
        )
    }
    // chrome gallery
    else if (tab.url.indexOf('https://chrome.google.com/webstore') == 0) {
        pickButton(tab, false, "Chrome doesn't allow its <i>extensions</i> to play on Web Store.")
    }
    // local pages
    else if (tab.url.indexOf('file') === 0) {
        chrome.extension.isAllowedFileSchemeAccess((isAllowedAccess) => {
            if (isAllowedAccess) {
                pickButton(tab, true)
            } else {
                pickButton(
                    tab,
                    false,
                    '<strong>Eye Dropper</strong> can\'t access local pages unless you grant it the permission. Check <a href="#" id="link-help-file-urls" data-url="https://eyedropper.org/help/file-urls">the instructions how to allow it</a>.',
                )
                initExternalLink(document.getElementById('link-help-file-urls') as HTMLLinkElement)
            }
        })
    } else {
        pickButton(tab, true)
    }
}

/**
 * Handle tab switching
 *
 * TODO: handle ajax loading
 * TODO: handle pamatovani si jestli uz je nacteny nebo ne
 *
 * FIXME: change to something sane and not so ugly
 *
 * @param {string} tabId id of tab to switch to
 *
 */
function switchTab(tabId: string) {

    // color picker tab
    if (cpicker) {
        cpicker.remove()
    }

    function loadTab(tabId: string) {
        console.group('tabSwitch')
        let content_found = false
        const content_pages = document.getElementsByClassName(
            'content-page',
        ) as HTMLCollectionOf<HTMLElement>
        for (let n of content_pages) {
            console.info(`found tab content ${n.id}`)
            if (n.id === `${tabId}-content`) {
                n.style.display = 'block'
                content_found = true
                console.info(`Found content for ${n.id}, switching.`)
            } else {
                n.style.display = 'none'
                console.info(`Hiding content for tab ${n.id}`)
            }
        }

        if (!content_found) {
            console.info('XMLHttp: No content found, loading through AJAX')
            let request = new XMLHttpRequest()
            request.open('GET', `/${tabId}.html`)

            request.onload = () => {
                if (request.status >= 200 && request.status < 400) {

                    initExternalLinks()
                    if (tabId === 'tab-cp') {
                        loadColorPicker()
                    }
                } else {
                    console.error(`Error loading ${tabId} content through AJAX: ${request.status}`)
                }
            }

            request.send()
        } else {
            // color picker tab
            if (tabId === 'tab-cp') {
                showColorPicker()
            }
        }
        console.groupEnd()
    }
}

function loadColorPicker() {
    console.info('Showing cpicker')
    cpicker_input = document.getElementById('colorpicker-input')
    cpicker_input.value = bgPage.bg.getColor()

    showColorPicker()

    // Listen for changes from input field
    cpicker_input.addEventListener('input', () => {
        // no color format can be smaller then 3 chars
        if (cpicker_input.value.length >= 3) {
            // try to create new EdColor instance
            const c = new EdColor(cpicker_input.value)
            // if it is working, change color in picker
            if (c) {
                cpicker.setColor(c.toHexString())
            }
        }
    })
}


function showColorPicker() {
    // create new cpicker instance
    cpicker = new ColorPicker({
        el: document.getElementById('colorpicker'),
        color: cpicker_input.value,
    })

    // listen on picker changes
    cpicker.onChange(() => {
        const color = cpicker.getHexString().toLowerCase()

        // do not change input value if color change was caused externally
        if (cpicker.isChoosing) {
            cpicker_input.value = color
        }

        // always change new colorBox to new color
        //       colorBox('new', color)
    })
}

function changeColorPicker(color_hex: string) {
    if (cpicker) {
        cpicker_input.value = color_hex
        cpicker.setColor(color_hex)
    }
}