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

function toId(s) {
  return s.toLowerCase().replace(/[^a-zA-Z0-9]+/g, '_')
}

/* hideOldStuff can be removed after updating the script to not include the questions at the end of each page,
    but to instead include them in arguments.yml */
function hideOldStuff(argument) {
  $('.nav-answers-old').hide();
  $('.question').hide();

  // Don't remove the links section if the page has no questions
  if (!argument.askQuestion) return

  for (let a of $('div a')) {
    if (a.id === 'feedback_button') continue
    if (a.childNodes.length <= 1 && a.parentNode.innerText.match(/➥|✉/))
      $(a.parentNode).hide()
  }
}

function insertTitleQuestion(argument) {
  if (argument.question) {
    $(`<h2>${argument.question}</h2>`).appendTo($('.page-content'));
  } else {
    if (argument.subArguments?.length > 0) {
      $('<h2>Do you agree?</h2>').appendTo($('.page-content'));
    } else {
      $('<h2>Do you find the above arguments convincing?</h2>').appendTo($('.page-content'));
    }
  }
}

function insertSubargumentCheckboxes(checkboxesSection, argument) {
  for (const subArgument of argument.checkboxArguments()) {
    const id = toId(subArgument.name)
    const checkboxes = $('<li />', {class: 'checkbox-hitbox'}).appendTo(checkboxesSection);
    const effect = subArgument.effect || 'disagree'
    const checked = subArgument.getAgreement() === effect
    if (subArgument.parentListingType === 'checkbox') {
      $('<input />', {
        type: 'checkbox',
        id: `cb_${id}`,
        'data-url': subArgument.agreeTargetUrl || subArgument.url,
        'data-effect': subArgument.effect || 'disagree',
        value: id,
        checked
      }).appendTo(checkboxes);
      $('<label />', {
        'for': `cb_${id}`,
        text: subArgument.text || subArgument.name,
      }).appendTo(checkboxes);
    } else if (subArgument.parentListingType === 'button') {
      $('<a />', {
        id: `button_${id}`,
        class: 'answer-button-link',
        'href': `${window.site_baseurl}` + subArgument.url,
        'data-url': subArgument.url,
        'data-effect': subArgument.effect || 'disagree',
        value: id,
        text: subArgument.text || subArgument.name,
      }).appendTo(checkboxes);
    }
  }
}

function insertYesNoCheckboxes(checkboxesSection, argument) {
  let checkboxes = $('<li />', {class: 'checkbox-hitbox'}).appendTo(checkboxesSection);
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
    text: 'Yes',
  }).appendTo(checkboxes);

  checkboxes = $('<li />', {class: 'checkbox-hitbox'}).appendTo(checkboxesSection);
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
    text: 'No'
  }).appendTo(checkboxes);
}

function insertCheckboxes(argument) {
  const checkboxesSection = $('<ul />', {class: 'nav-answers'}).appendTo($('.page-content'));
  if (argument.checkboxArguments().length > 0) {
    insertSubargumentCheckboxes(checkboxesSection, argument)
  } else {
    insertYesNoCheckboxes(checkboxesSection, argument)
  }
}

function insertSubargumentLinks(argument) {
  const links = $('<ul />', {class: 'nav-answer-links'}).appendTo($('.page-content'));
  if (argument.checkboxArguments().length > 0) {
    $('<h2>Want to read more on these topics?</h2>').appendTo(links);
    for (const subArgument of argument.checkboxArguments()) {
      if (subArgument.type === 'button') continue
      const id = toId(subArgument.name)
      const visibility = subArgument.getAgreement() === (subArgument.effect || 'disagree')
      const displayStyle = visibility ? 'block' : 'none'
      const link = $(`<a />`, {
        class: 'answer-link',
        style: `display: ${displayStyle}`,
        id: `link_${id}`,
        href: `${window.site_baseurl}` + (subArgument.answerLinkUrl || subArgument.url),
        'data-url': subArgument.answerLinkUrl || subArgument.url
      }).appendTo(links);
      $('<span />', {html: subArgument.linkName}).appendTo(link)
    }
    Argument.updateLinkSectionVisibility()
  }
}

function insertGoBackLink(argument) {
  const argParent = getArgumentParent(args, argument)
  if (!argParent) return
  
  const link = $(`<a />`, {
    class: 'go-back-link',
    href: `${window.site_baseurl}` + argParent.url,
    'data-url': argParent.url,
    title: argParent.name
  }).appendTo($('.page-content'));
  $('<span />', {html: '➥ Go back'}).appendTo(link)
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
    if (arg.url === url) return true
  }
  return false
}

function linkClick(event) {
  event.preventDefault();
  const link = $(event.currentTarget)
  const path = `${window.site_baseurl}` + link.data('url')
  const scrollTop = isRootArgumentUrl(link.data('url'))
  getHtml(path, true, true, scrollTop)
}

function insertAnswerSection(path) {
  const argument = Argument.findArgumentByPath(args, path);
  if (!argument) 
    throw `Couldn't find argument for ${path}`;

  hideOldStuff(argument)
  if (!argument.askQuestion) return

  insertTitleQuestion(argument)
  insertCheckboxes(argument)
  insertSubargumentLinks(argument)
  insertGoBackLink(argument)

  $('.nav-answers input').on('change', checkboxChange)
  $('.checkbox-hitbox').on('click', (event) => {
    // only catch events that landed in the div empty space, otherwise we'd duplicate
    // events that landed on the label
    if (event.target !== event.currentTarget) return

    const checkbox = $(event.currentTarget).find('input')
    checkbox.prop('checked', !checkbox.prop('checked')).change()
  })
  $('.answer-link, .answer-button-link').on('click', linkClick)
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

function updateSidebar(path) {
  const argument = Argument.findArgumentByPath(args, path);
  const rootArgument = getArgumentRoot(argument);
  const argumentSection = $(`.argument-map .root-argument-container > a[data-url='${window.site_baseurl}${rootArgument.url}']`).parent()
  $('.argument-branch-sidebar').empty()
  argumentSection.clone().appendTo($('.argument-branch-sidebar'))
}

function getHtml(path, saveAddress = true, scrollIntoView = false, scrollTop = false) {
  const html_path = html_asset_path(path)
  $.get(html_path).done(data => {
    $('.page-content').html(data);
    const title = $('.page-content .page-data').data('page-title');
    $('.page-title').html(title);
    insertAnswerSection(path);
    transformRootArgumentLinks();
    updateSidebar(path);
    if (saveAddress)
      window.history.pushState({}, "", path);

    if (scrollTop) {
      $(document).scrollTop(0)
    } else if (scrollIntoView) {
      $('#argument_section')[0].scrollIntoView();
    }
  })
}

function recordAnswer(url, agreement) {
  const argument = Argument.findArgumentByPath(args, url)
  argument.setAgreement(agreement)
  saveAnswers()
  updateSubSubArgumentVisibility()
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
    if (!argument) debugger

    const checkbox = $(`input[data-url='${url}']`)
    checkbox.prop('checked', true)
  }
}

function recursiveAttachAnswers(currentArguments, answers) {
  for (const argument of currentArguments) {
    if (answers[argument.url]) {
      argument.setAgreement(answers[argument.url], false)
    }
    if (argument.subArguments?.length > 0) {
      recursiveAttachAnswers(argument.subArguments, answers)
    }
  }
}


function getArgumentParent(currentArguments, argumentToFind) {
  for (const argument of currentArguments) {
    if (argument.subArguments?.length > 0) {
      if (argument.subArguments.find((arg) => arg.url === argumentToFind.url))
        return argument

      const argParent = getArgumentParent(argument.subArguments, argumentToFind)
      if (argParent) return argParent;
    }
  }
  return null
}

function getArgumentRoot(argumentToFind) {
  let argAncestor = argumentToFind
  while (true) {
    const nextAncestor = getArgumentParent(args, argAncestor)
    if (nextAncestor) {
      argAncestor = nextAncestor
    } else {
      break
    }
  }
  return argAncestor
}

function updateSubSubArgumentVisibility() {
  for (const subSection of $('.sub-sub-argument')) {
    let subNodesNotable = $(subSection).find('.argument-shape-link').filter((i, node) => ($(node).hasClass('disagree') || $(node).hasClass('none'))).length
    subNodesNotable += $(subSection).siblings('.argument-shape-link.agree, .argument-shape-link.disagree').length
    if (subNodesNotable > 0) {
      $(subSection).show()
    } else {
      $(subSection).hide()
    }
  }
}

function transformRootArgumentLinks() {
  for (const a of $('.nav-answer-links a, .page-content a')) {
    if (a.innerText.toLowerCase().match('go back')) continue
    const hrefEnd = $(a).prop('href').match(/\/([^/]*$)/)?.[1]
    const rootArgument = args.find(a => a.url.match(/\/([^/]*$)/)?.[1] === hrefEnd)

    if (rootArgument) {
      $(a).addClass('root-argument')
      $(a).addClass(rootArgument.agreement)
      $(a).data('url', `${window.site_baseurl}` + rootArgument.url)
    }
  }
}

function initPage() {
  for (const argument of window.argumentPages) {
    args.push(new Argument(args, argument))
  }

  loadAnswers()
  updateSubSubArgumentVisibility()

  $('body').on('click', '.root-argument, .argument-shape-link', (event) => {
    event.preventDefault();
    const path = $(event.currentTarget).data('url');
    getHtml(path, true, true);
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
    if (y + $('#header')[0].clientHeight > $('.argument-section')[0].offsetTop) {
      $('.argument-branch-sidebar').fadeIn()
    } else {
      $('.argument-branch-sidebar').fadeOut()
    }
  });
}

initPage()