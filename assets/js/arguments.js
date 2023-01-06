/* eslint-env jquery */
/* global Cognito */

import Argument from './argument.js'

let args = []

function html_asset_path(path) {
  const path_parts = path.match(/(\/aird\/)(.*)/);
  if (!path_parts || path_parts.length < 3)
    throw `path mismatch for ${path}`

  return `${
    path_parts[1]
  }assets/html/${
    path_parts[2]
  }`
}

function insertTitleQuestion(argument) {
  if (argument.question) {
    $(`<h2>${argument.question}</h2>`).appendTo($('.page-content'));
	if (argument.questionSubtext)
		$(`<p style='font-style:italic'>${argument.questionSubtext}</p>`).appendTo($('.page-content'));
  } else {
    if (argument.subArguments?.length > 0) {
      $('<h2>Do you agree or disagree?</h2>').appendTo($('.page-content'));
    } else {
      $('<h2>Do you think the reasoning above is valid?</h2>').appendTo($('.page-content'));
    }
  }
}

function insertSubargumentCheckboxes(checkboxesSection, argument) {
  for (const subArgument of argument.checkboxArguments()) {
    const checkboxes = $('<li />', {class: 'checkbox-hitbox answer-label-link-container'}).appendTo(checkboxesSection);
    const effect = subArgument.effect || 'disagree'
    const checked = subArgument.getAgreement() === effect
    if (subArgument.parentListingType === 'checkbox') {
      $('<input />', {
        type: 'checkbox',
        id: `cb_${subArgument.nameAsId()}`,
        'data-url': subArgument.agreeTargetUrl || subArgument.url,
        'data-effect': subArgument.effect || 'disagree',
        value: subArgument.nameAsId(),
        checked
      }).appendTo(checkboxes);
      $('<label />', {
        'for': `cb_${subArgument.nameAsId()}`,
        class: 'has-link',
        text: subArgument.text || subArgument.name,
      }).appendTo(checkboxes);

      const link = $(`<a />`, {
        class: `answer-link link-${subArgument.nameAsId()}`,
        href: `${window.site_baseurl}` + (subArgument.answerLinkUrl || subArgument.url),
        'data-url': subArgument.answerLinkUrl || subArgument.url
      })
      link.appendTo(checkboxes)
      $('<i />', { class: "icon fa-chevron-right" }).appendTo(link)

    } else if (subArgument.parentListingType === 'button') {
      const buttonLink = $('<a />', {
        id: `button_${subArgument.nameAsId()}`,
        class: 'answer-button-link',
        'href': `${window.site_baseurl}` + subArgument.url,
        'data-url': subArgument.url,
        'data-effect': subArgument.effect || 'disagree',
        value: subArgument.nameAsId()
      }).appendTo(checkboxes);
      $('<span />', { html: subArgument.text || subArgument.name }).appendTo(buttonLink)
      $('<i />', { class: "icon fa-chevron-right" }).appendTo(buttonLink)
    }
  }
}

function insertYesNoCheckboxes(checkboxesSection, argument) {
  let checkboxes = $('<li />', {class: 'checkbox-hitbox answer-label-link-container'}).appendTo(checkboxesSection);
  $('<input />', {
    type: 'checkbox',
    id: `cb_yes`,
    value: 'yes',
    'data-effect': 'agree',
    'data-url': argument.agreeTargetUrl || argument.url,
    checked: argument.agreement === 'agree'
  }).appendTo(checkboxes);
  $('<label />', {
    'for': `cb_yes`,
    class: 'yes-no',
    text: 'Yes',
  }).appendTo(checkboxes);

  checkboxes = $('<li />', {class: 'checkbox-hitbox answer-label-link-container'}).appendTo(checkboxesSection);
  $('<input />', {
    type: 'checkbox',
    id: `cb_no`,
    value: 'no',
    'data-effect': 'disagree',
    'data-url': argument.agreeTargetUrl || argument.url,
    checked: argument.agreement === 'disagree'
  }).appendTo(checkboxes);
  $('<label />', {
    'for': `cb_no`,
    class: 'yes-no',
    text: 'No'
  }).appendTo(checkboxes);
}

function insertCheckboxes(argument) {
  $('.nav-answer-links').empty();
  const checkboxesSection = $('<ul />', {class: 'nav-answers'}).appendTo($('.page-content'));
  if (argument.checkboxArguments().length > 0) {
    insertSubargumentCheckboxes(checkboxesSection, argument)
  } else {
    insertYesNoCheckboxes(checkboxesSection, argument)
  }
}

function insertNextSectionButton(argument) {
  if (!argument.nextSectionArgument()) return
  let text = "Progress to the next section:"
  if (argument.name === 'Introduction') {
    // unprincipled special case just for Introduction
    text = "Let's begin!"
  }
  $(`<h3 />`, {
    text
  }).appendTo($('.page-content'));
  $(`<a />`, {
    class: 'root-argument',
    href: window.site_baseurl + argument.nextSectionArgument().url,
    'data-url': argument.nextSectionArgument().url,
    title: argument.nextSectionArgument().name,
    text: argument.nextSectionArgument().name
  }).appendTo($('.page-content'));
}

function insertGoBackLink(argument) {
  if (!argument.parent) return
  const url = argument.parent.nodeLinkUrl || argument.parent.url
  const link = $(`<a />`, {
    class: 'go-back-link',
    href: window.site_baseurl + url,
    'data-url': argument.parent.url,
    title: argument.parent.name
  }).appendTo($('.page-content'));
  $('<span />', {html: '↰ Return'}).appendTo(link)
  $(link).data('url', url)
}

function checkboxChange(event) {
  const checkbox = $(event.currentTarget)

  let agreement
  if (checkbox.prop('checked')) {
    agreement = checkbox.data('effect')
  } else {
    agreement = 'undecided'
  }

  recordAnswer(checkbox.data('url'), agreement)

  if (event.currentTarget.id === 'cb_no' && $(event.currentTarget).prop('checked')) pulseFeedbackButton()

  const label = checkbox.parent().find('label')
  label.addClass('pulse')
  window.setTimeout(() => {
    label.removeClass('pulse')
  }, 100)
}

function isRootArgumentUrl(url) {
  for (const arg of args) {
    if (arg.url === url || (`${window.site_baseurl}` + arg.url) === url) return true
  }
  return false
}

function insertAnswerSection(argument) {
  if (!argument.askQuestion) {
    insertNextSectionButton(argument)
    return
  }

  insertTitleQuestion(argument)
  insertCheckboxes(argument)
  insertGoBackLink(argument)
  insertNextSectionButton(argument)

  $('.nav-answers input').on('change', checkboxChange)
  $('.checkbox-hitbox').on('click', (event) => {
    // only catch events that landed in the div empty space, otherwise we'd duplicate
    // events that landed on the label
    if (event.target !== event.currentTarget) return

    const checkbox = $(event.currentTarget).find('input')
    checkbox.prop('checked', !checkbox.prop('checked')).change()
  })
}

function toggleFeedback() {
  $("#feedback").toggle()
}

function pulseFeedbackButton() {
  $('a[href="#feedback"]').addClass('feedback-button-pulsed')
  window.setTimeout(() => {
    $('a[href="#feedback"]').removeClass('feedback-button-pulsed')
  }, 300)
}

function updateBranchSidebar(argument) {
  const argumentSection = $(`.argument-map .root-argument-container > a[data-url='${argument.rootArgument().url}']`).parent()
  $('.argument-branch-sidebar').empty()
  argumentSection.clone().appendTo($('.argument-branch-sidebar'))
}

function updateActiveLink(path) {
  const url = path.substr(5)
  $('.argument-shape-link').removeClass('active')
  $(`.argument-shape-link[data-url='${url}']:not(.indirect-node)`).addClass('active')
}

function recordScrollPosition() {
  localStorage.setItem(`scrollPos ${window.location.pathname}`, document.documentElement.scrollTop)
}

// scroll parameter can be 'into_view', 'top', 'history' or undefined.
// into_view (used by most links to content pages) scrolls down to the content
// top (used by links to root level arguments) scrolls to the top
// history (used by Go Back links) scrolls to where they were last time they were on the page
function getHtml(path, saveAddress = true, scrollParam) {
  if (path !== window.location.href) recordScrollPosition()
  const html_path = html_asset_path(path)
  $.get(html_path).done(data => {
    $('.page-content').html(data);

    const argument = Argument.findArgumentByPath(args, path);
    if (!argument)
      throw `Couldn't find argument for ${path}`;

    const title = $('.page-content .page-data').data('page-title');
    document.title = title
    $('.page-title').html(argument.text || argument.name);
    insertAnswerSection(argument);
    transformRootArgumentLinks();
    updateBranchSidebar(argument);
    updateActiveLink(path);
    if (saveAddress)
      window.history.pushState({}, "", path);

    switch (scrollParam) {
      case 'top':
        $(document).scrollTop(0)
        break;
      case 'into_view':
        $('#argument_section')[0].scrollIntoView();
        break;
      case 'history':
        const scrollPos = localStorage.getItem(`scrollPos ${window.location.pathname}`) // eslint-disable-line
        $(document).scrollTop(scrollPos)
    }
  })
}

function recordAnswer(url, agreement) {
  const argument = Argument.findArgumentByPath(args, url)
  argument.setAgreement(agreement)
  saveAnswers()
  Argument.updateSubSubArgumentVisibility()
}

function saveAnswers() {
  let answers = recursiveBuildAnswers(args, {})
  localStorage.setItem('answers', JSON.stringify(answers))
}

function recursiveBuildAnswers(currentArguments, answers) {
  for (const argument of currentArguments) {
    if (argument.agreement && argument.url)
      answers[argument.url] = argument.agreement
    
    if (argument.subArguments?.length > 0) {
      recursiveBuildAnswers(argument.subArguments, answers)
    }
  }
  return answers
}

function loadAnswers() {
  let answers = JSON.parse(localStorage.getItem('answers'))
  if (!answers) return

  recursiveAttachAnswers(args, answers)
  for (const [url, agreement] of Object.entries(answers)) {
    const argument = Argument.findArgumentByPath(args, url)
    if (!argument) console.warn(`Couldn't find argument '${url}'`)

    const checkbox = $(`input[data-url='${url}']`)
    checkbox.prop('checked', true)
  }
}

function recursiveAttachAnswers(currentArguments, answers) {
  for (const argument of currentArguments) {
    if (answers[argument.url]) {
      argument.setAgreement(answers[argument.url], false, false)
    }
    if (argument.subArguments?.length > 0) {
      recursiveAttachAnswers(argument.subArguments, answers)
    }
  }
}

function transformRootArgumentLinks() {
  for (const a of $('.page-content a')) {
    if ($(a).hasClass('answer-link')) continue
    if (a.innerText.toLowerCase().match('return')) continue

    const hrefEnd = $(a).prop('href').match(/\/([^/]*$)/)?.[1]
    const rootArgument = args.find(a => a.url.match(/\/([^/]*$)/)?.[1] === hrefEnd)

    if (rootArgument) {
      $(a).addClass('root-argument')
      $(a).addClass(rootArgument.agreement)
      $(a).data('url', rootArgument.url)
    }
  }
}

function initPage() {
  for (const argument of window.argumentPages) {
    args.push(new Argument(args, argument))
  }

  loadAnswers()
  Argument.updateSubSubArgumentVisibility()

  $('body').on('click', '.root-argument, .argument-shape-link, .answer-link, .answer-button-link', (event) => {
    event.preventDefault();
    const link = $(event.currentTarget)
    const path = `${window.site_baseurl}` + $(link).data('url');
    let scrollParam
    if (isRootArgumentUrl(link.data('url'))) {
      scrollParam = 'top'
    } else if (link.hasClass('answer-link') || link.hasClass('.answer-button-link')) {
      scrollParam = 'into_view'
    }
    getHtml(path, true, scrollParam);
  })
  $('body').on('click', '.go-back-link', (event) => {
    event.preventDefault();
    const link = $(event.currentTarget)
    const path = `${window.site_baseurl}` + $(link).data('url');
    getHtml(path, true, 'history');
  })

  // Because we're messing with the address with window.history.pushState, when the user clicks the Back
  // button, it doesn't cause a page load, so we listen for the popstate event and cause the page load manually.
  window.addEventListener('popstate', function() {
    getHtml(window.location.pathname, false)
  });

  getHtml(window.location.pathname);

  $('a[href="#feedback"]').on('click', () => {
    toggleFeedback();
  })

  Cognito.prefill({
    "CurrentURL": window.location.pathname,
    "NodeHistory": window.argNodeHistory.join(', '),
    "LandingPath": localStorage.getItem('LandingPath'),
    "sParam": localStorage.getItem('sParam'),
    "Referrer": localStorage.getItem('Referrer')
  });

  $(window).on('scroll resize', () => {
    const y = window.scrollY;
    if (y + $('#header')[0].clientHeight > $('.argument-section')[0].offsetTop - 10) {
      $('.argument-branch-sidebar').fadeIn()
    } else {
      $('.argument-branch-sidebar').fadeOut()
    }
  });
}

initPage()