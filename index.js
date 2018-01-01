const port = chrome.runtime.connect();

const enableDebug = () => {
    window.addEventListener('message', (event) => {
        if (event.source != window) {
            return;
        }

        if (event.data.type && (event.data.type == 'FROM_PAGE')) {
            console.log('content script recieved');
            port.postMessage(event.data.text);
        }
    }, false);
};

enableDebug();

/**
 * Converts a package's HTML to an object
 * @param {HTMLElement} package 
 * @returns {object} { name, version, description, hidden } object
 */
function packageToData(package) {
    return {
        name: package.querySelector('a').textContent,
        version: package.querySelector('strong').textContent,
        description: package.textContent,
        hidden: package.dataset.hidden || false
    }
}

/**
 * Determins if this is the user's account.
 * Assume that if they can log in as that user, then that account is theirs.
 * @returns {boolean}
 */
function isOwnAccount() {
    const username = document.getElementById('salutation-username').textContent;
    const columnHeading = document.querySelector('.content-column h1');
    if (columnHeading && columnHeading.textContent == username) return true;
    return false;
}

/**
* @returns {number} num of hidden packages
*/
function countHiddenPackages(data) {
    return data.filter(v => v.hidden).length;
}

/**
* @returns {NodeList} The User's packages
*/
function getPackages() {
    return document.querySelector('.collaborated-packages').querySelectorAll('li');
}

/**
 * Updates the hidden packages link with the # of hidden packages & up or down arrow.
 * Updates the hidden packages list with a list of hidden packages.
 * @param {*object} data Packages Data
 * @param {*boolean} openedHiddenPackages 
 */
function updateHiddenPackages(data, openedHiddenPackages) {
    const hiddenPackagesLink = document.getElementById('hidden');
    hiddenPackagesLink.textContent = `Hidden Packages (${countHiddenPackages(data)}) ${openedHiddenPackages ? '▲' : '▼' }`;
    const hiddenPackagesList =  document.querySelector('.hidden-packages');
    hiddenPackagesList.innerHTML = data.filter(f => f.hidden).map(pkg => `<li><a href='/package/${pkg.name}/'>${pkg.name}</a> - <strong>${pkg.version}</strong></li>`).join('');
}

/**
 * Runs `updateHiddenPackages` on hidden packages
 * @param {*} data 
 * @param {boolean} openedHiddenPackages
 */
function handleHidden(openedHiddenPackages, packagesElement) {
    const data = getPackagesFromStorage() || [];
    
    const hiddenPackages = data.filter(p => p.hidden);
    console.log(data);
    
    hiddenPackages.forEach((item, index) => {
        console.log('packages element', packagesElement[index], index);
        packagesElement[index].style.display = 'none';
    });

    updateHiddenPackages(data, openedHiddenPackages);

    console.log(`
        HiddenPackages: ${hiddenPackages.length}
    `);
}

function createHiddenPackagesUI ({ packagesData, openedHiddenPackages }) {
    // Determine where to anchor the hidden packages list
    // Try starred packages and if that list doesn't exist, use collaborated packages
    const hiddenPackagesAnchor = document.querySelector('.starred-packages') || document.querySelector('.collaborated-packages');
    
    hiddenPackagesAnchor.insertAdjacentHTML('afterend', `
        <h2 class='undecorated'>
            <a id='hidden' href='#hidden'>Hidden Packages (${countHiddenPackages(packagesData)}) ▼</a>
        </h2>
        <ul style='display: ${hideOrShow(openedHiddenPackages)}' class='bullet-free hidden-packages'></ul>
    `);

    const hiddenPackagesLink = document.getElementById('hidden');
    const hiddenPackagesList = document.querySelector('.hidden-packages');

    hiddenPackagesLink.addEventListener('click', (event) => {
        if (!openedHiddenPackages) {
            hiddenPackagesLink.textContent = `Hidden Packages (${countHiddenPackages(packagesData)}) ▲`;
            hiddenPackagesList.style.display = hideOrShow(openedHiddenPackages);
            openedHiddenPackages = !openedHiddenPackages;
        } else {
            hiddenPackagesLink.textContent = `Hidden Packages (${countHiddenPackages(packagesData)}) ▼`;
            hiddenPackagesList.style.display = hideOrShow(openedHiddenPackages);
            openedHiddenPackages = !openedHiddenPackages;
        }
    })
}

function handleBodyEventListener () {
    document.body.addEventListener('click', event => {
        if (event.target.className == 'package-manager' || event.target.className == 'manager-menu') {

        } else {
            const packageManagers = document.querySelectorAll('.package-manager');
            const menus = Array.from(packageManagers).map(pkmng => pkmng.querySelector('.manager-menu'));
            packageManagers.forEach((item, index) => { if (menus[index]) item.removeChild(menus[index]) });
        }
    }, false);

}

const hidePackage = (event, data, packagesData) => {
    data.hidden = true;
    chrome.storage.local.set({ 'packages': packagesData }, () => console.log(packagesData));
    console.log('hidden:', packagesData.filter(p => p.hidden));
}

const createPackageManager = ({ data, pkg, packagesData, openedHiddenPackages }) => {
    const el = document.createElement('div');
    el.textContent = '☰';
    el.className = 'package-manager';
    el.addEventListener('click', (event) => {
        if (el.querySelector('.manager-menu') == null) {
            
                const menu = document.createElement('div');
                menu.className = 'manager-menu';
                menu.textContent = 'Hide';
                menu.addEventListener('click', () => {
                    hidePackage(event, data, packagesData);
                    el.removeChild(menu);
                    document.querySelector('.collaborated-packages').removeChild(pkg);
                    updateHiddenPackages(packagesData, openedHiddenPackages);
                    chrome.storage.local.set({ 'packages': packagesData });
                });
                el.insertAdjacentElement('beforeend', menu);
            
        }
    }, false);
    return el;
}

const getPackagesFromStorage = () => {
    return chrome.storage.local.get('packages', p => {
        console.log('Packages from storage: ', p.packages);
        return p.packages;
    })
}

/**
 * If v is false, return 'none', else return 'block'
 * Used for setting display on HTMLElements.
 * @param {boolean} v Any variable
 */
const hideOrShow = v => v ? 'block' : 'none';

function sortByName (a, b) {
    const nameA = a.name.toLowerCase();
    const nameB = b.name.toLowerCase();
    if (nameA < nameB) {
        return -1;
    }
    if (nameA > nameB) {
        return 1;
    }
    return 0;
}

if (isOwnAccount()) {
    let openedHiddenPackages = false;
    const packages = getPackages();

    

    if (packages != null) {
        const packagesData = getPackagesFromStorage() || Array.from(packages).map(pkg => packageToData(pkg));
        //chrome.storage.local.set({ 'packages': packagesData });

        document.querySelector('.collaborated-packages').innerHTML = '';

        const genPackageList = (packagesData) => {
            return packagesData.filter(i => !i.hidden).sort(sortByName).map((item, index) => {
                return `<li>
                    <a href='/package/${item.name}'>${item.name}</a>
                    -
                    <strong>${item.version}</strong>
                    -
                    ${(/[^-]+$/g.exec(item.description) || [])[0]}
                </li>`
            }).join('');
        }

        document.querySelector('.collaborated-packages').innerHTML = genPackageList(packagesData);

        console.log(packagesData.filter(p => p.hidden).length, ' hidden packages');


        createHiddenPackagesUI({ packagesData, openedHiddenPackages });
        handleHidden(openedHiddenPackages,  packages );
        handleBodyEventListener();

        getPackages().forEach((pkg, index) => {
            pkg.insertAdjacentElement('afterbegin', createPackageManager({
                data: packagesData[index],
                pkg,
                packagesData,
                openedHiddenPackages
            }));
        })

        chrome.storage.local.set({ 'packages': packagesData });

        
    } else {

    }

}



