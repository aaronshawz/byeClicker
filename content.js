window.onload = () => {
    chrome.storage.local.remove('status');

    const targetNode = document.querySelector('#main-wrapper');
    const HOST = 'https://bye-clicker-api.vercel.app';

    // Set default values
    let random;
    let autoJoin;
    let notify;
    let access_token;
    let activity;
    let courseId;
    let activityId;
    let requestOptions;
    let intervalId; // some timer to keep checking the  course and activity
    const optionsToIndex = {
        'A': 0,
        'B': 1,
        'C': 2,
        'D': 3,
        'E': 4,
    } //  this converts from letters in response to choice in post

    chrome.storage.local.get(['notify'], function(result) {
        if (result.notify == true) {
            notify = true;
        } else if (result.notify == false || result == undefined ) {
            notify = false;
        }
    }); // notify button status

    chrome.storage.local.get(['random'], function(result) {
        if (result.random == true) {
            random = true;
        } else if (result.random == false || result == undefined) {
            random = false;
        }
    }); // random button status

    chrome.storage.local.get(['autoJoin'], function(result) {
        if (result.autoJoin == true) {
            autoJoin = true;
        } else if (result.autoJoin == false || result == undefined) {
            autoJoin = false;
        }
    }); // autojoin button status
    
    let fetchCalled = false; // ?

    const observerConfig = { 
        attributes: true,  // Watch for attribute changes (e.g., style changes)
        attributeFilter: ['style'], // Only observe changes to style attribute
        childList: true, 
        subtree: true, 
    }; // chrome stuff methinks

    const observer = new MutationObserver(function(mutationsList) {
        const url = window.location.href;
        for (let mutation of mutationsList) {
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                for (let node of mutation.addedNodes) {
                    if (node instanceof Element) {
                        if (url == "https://student.iclicker.com/#/polling") { // page only works on iclicker polling site
                            if (node.matches('.polling-page-wrapper')) {
                                setTimeout(() => {
                                    setVariables();
                                }, 3000); // listen for next question
                                try {
                                    const btns = document.querySelectorAll('.btn-container');
                                    if (random) {
                                        var optionIndex = getRandomInteger(btns.length);
                                    } else {
                                        var optionIndex = 0;
                                    }
                                    
                                    if (notify && !fetchCalled) {
                                        fetchCalled = true;
                                        let img = "https://institutional-web-assets-share.s3.amazonaws.com/iClicker/student/images/image_hidden_2.png"
                                        const imgContainer = document.getElementsByClassName('question-image-container');
                                        setTimeout(() => {
                                            const source = imgContainer[0].querySelectorAll('img')[1].src
                                            if(source != undefined && source != "") {
                                                img = imgContainer[0].querySelectorAll('img')[1].src;
                                            }
                                            chrome.storage.local.get(['email'], (result) => {
                                                const email = result.email;
                                                fetch(`${HOST}/notify`, {
                                                    method: 'POST',
                                                    headers: {
                                                        'Content-Type': 'application/json',
                                                    },
                                                    body: JSON.stringify({email: email, type: 'ques', img: img}),
                                                }) // send the notification email
                                                .then(res => res.json())
                                                .then(data => {
                                                    // console.log(data);
                                                    fetchCalled = false;
                                                    clearInterval(intervalId); // clear the timer before reading the responses 
                                                    checkAnswer(btns, optionIndex); // actually call the function that checks the responses and makes a choice
                                                })
                                                .catch(err => {
                                                    console.log(err);
                                                    fetchCalled = false;
                                                    clearInterval(intervalId); // 2
                                                    checkAnswer(btns, optionIndex); 
                                                });
                                            });
                                        }, 1000); // image notification block if notifyme clicked
                                    }
                                    clearInterval(intervalId);// this is called 3 FUCVKING times
                                    checkAnswer(btns, optionIndex);
                                } catch (error) {
                                    console.log('buttons not found')
                                }
                            }
                        } else if (url.includes('https://student.iclicker.com/#/courses')) { // somethign the courses pages (not anything interesting)
                            if (node.matches('.course-wrapper')) {
                                stopObserver('default');
                            }
                        }
                    }
                }
            } else if(mutation.type === 'attributes' && mutation.attributeName === 'style') {
                // console.log('CSS change detected:', mutation.target);
                if (url.includes('https://student.iclicker.com/#/courses') && url.includes('/tab/default') && autoJoin) { // if on the courses pages
                try{
                    if(document.querySelector('#join-inner-container').style.display == 'block' && notify && !fetchCalled) {
                        fetchCalled = true;
                            // notify backend to send email
                            chrome.storage.local.get(['email'], (result) => {
                                const email = result.email;
                                fetch(`${HOST}/notify`, {
                                    method: 'POST',
                                    headers: {
                                        'Content-Type': 'application/json',
                                    },
                                    body: JSON.stringify({email: email, type: 'classStart'}),
                                })
                                .then(res => res.json())
                                .then(data => {
                                    // console.log(data);
                                    document.querySelector('#btnJoin').click();
                                    fetchCalled = false;
                                })
                                .catch(err => console.log(err));
                            });
                        document.querySelector('#btnJoin').click();
                    }
                } catch (error) {
                    console.log('join button not found')
                }
                }
            }
        }
    });

    function checkAnswer(btns, optionIndex) { // this does the cool stuff :D
        intervalId = setInterval(() => {
            fetch(`https://activity-service.iclicker.com/reporting/courses/${courseId}/activities/${activityId}/questions/view
            `, requestOptions) // fetch all of the answers for a course and activity
            .then(response => response.json())
            .then(data => {
                const answerOverview = data.data.questions[data.data.questions.length - 1].answerOverview;
                if(answerOverview.length == 0) {
                    btns[optionIndex].children[0].click(); // clicks the first one if 0 length
                    return;
                }
                const maxPercentageOption = answerOverview.reduce((maxOption, currentOption) => ( // finds the one with the most answers
                    currentOption.percentageOfTotalResponses > maxOption.percentageOfTotalResponses ? currentOption : maxOption // sets this 
                  ), answerOverview[0]);

                btns[optionsToIndex[maxPercentageOption.answer]].children[0].click(); // clicks the most clicked answer index
                // WHAT THE FUCK IS children[0] (something to do with html idk)
            })
            .catch((error) => {
                console.error('Error:', error);
            }); 
        }, 5000);
    }

    function setVariables() {
        access_token = sessionStorage.getItem('access_token');
        if (access_token == null || access_token == undefined || access_token == '') {
            // get access token from cookies
            access_token = document.cookie.split('; ').find(row => row.startsWith('access_token')).split('=')[1];
        }
        activity = JSON.parse(sessionStorage.getItem('activity'));
        courseId = activity.courseId;
        activityId = activity.activityId;
        requestOptions = {
            method: 'GET',
            headers: {
            'Authorization': `Bearer ${access_token}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Origin': 'https://student.iclicker.com',
            // Add any other headers as needed
            },
        };
    } // cookies parser this actually makes sense

    chrome.runtime.onMessage.addListener((message) => {
        if (message.from == 'popup' && message.msg == 'start') { // if start button pressed
            const url = window.location.href;
            if (url == "https://student.iclicker.com/#/polling") {
                setTimeout(() => {
                    setVariables();
                }, 3000);
                try {
                    const btns = document.querySelectorAll('.btn-container');
                    if (random) {
                        var optionIndex = getRandomInteger(btns.length); // set random if flag
                    } else {
                        var optionIndex = 0; // else first
                    }
                    clearInterval(intervalId); 
                    checkAnswer(btns, optionIndex); // actually call the function that checks the responses and makes a choice
                    // this does the first one if there is no other answers
                } catch (error) {
                    console.log('buttons not found')
                }
            } else if (url.includes('https://student.iclicker.com/#/courses') && url.includes('/tab/default')) {
                chrome.storage.local.get(['status'], function(result) {
                    if (result.status != 'started' && autoJoin) { // if the button is not started and autojoin
                        try{ // move the try catch into the combined if logic
                            if(document.querySelector('#join-inner-container').style.display == 'block') {
                                document.querySelector('#btnJoin').click(); // click the join button
                            }
                        } catch (error) {
                            console.log('join button not found')
                        }
                    }
                });
            }
            startObserver();
        } else if (message.from == 'popup' && message.msg == 'stop') {
            stopObserver('manual');
        } else if (message.from == 'popup' && message.msg == 'random') {
            random = !random;
            chrome.storage.local.set({random: random});
        } else if (message.from == 'popup' && message.msg == 'autoJoin') {
            autoJoin = !autoJoin;
            chrome.storage.local.set({autoJoin: autoJoin});
        } else if (message.from == 'popup' && message.msg == 'notify') {
            notify = !notify;
            chrome.storage.local.set({email: message.email});
            chrome.storage.local.set({notify: notify});
        }
    });

    function startObserver() {
        observer.observe(targetNode, observerConfig); // observe the webpage
        console.log('started answering')
        chrome.storage.local.set({status: 'started'})
    }

    function stopObserver(status) {
        observer.disconnect();
        if (status == 'default') {
            console.log('default stop')
            chrome.storage.local.remove('status');
            clearInterval(intervalId);
            if(notify && !fetchCalled) {
                fetchCalled = true;
                // notify backend to send email
                chrome.storage.local.get(['email'], (result) => {
                    const email = result.email;
                    fetch(`${HOST}/notify`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({email: email, type: 'classEnd'}),
                    })
                    .then(res => res.json())
                    .then(data => {
                        // console.log(data);
                        fetchCalled = false;
                        window.location.reload();
                    })
                    .catch(err => console.log(err));
                });
            }
        } else if (status == 'manual') {
            console.log('stopped')
            clearInterval(intervalId); //clear timer without calling again
            chrome.storage.local.set({status: 'stopped'})
        }
    }

    function getRandomInteger(max) {
        return Math.floor(Math.random() * max);
    }
}