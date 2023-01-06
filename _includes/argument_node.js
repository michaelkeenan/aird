/* eslint-disable */

{% assign decoded_page_url = argument.url | url_decode %}
{
  {% if argument.name != nil %}name : `{{argument.name}}`,{% endif -%}
  {% if argument.text != nil %}text : `{{argument.text}}`,{% endif -%}
  {% if decoded_page_url != '' %}url: `{{decoded_page_url}}`,{% endif -%}
  {% if argument.linkName != nil %}linkName : `{{argument.linkName}}`,{% endif -%}
  {% if argument.effect != nil %}effect : `{{argument.effect}}`,{% endif -%}
  {% if argument.answerLinkUrl != nil %}answerLinkUrl : `{{argument.answerLinkUrl}}`,{% endif -%}
  {% if argument.nodeLinkUrl != nil %}nodeLinkUrl : `{{argument.nodeLinkUrl}}`,{% endif -%}
  {% if argument.agreeTargetUrl != nil %}agreeTargetUrl : `{{argument.agreeTargetUrl}}`,{% endif -%}
  {% if argument.askQuestion != nil %}askQuestion : {{argument.askQuestion}},{% endif -%}
  {% if argument.parentListingType != nil %}parentListingType : `{{argument.parentListingType}}`,{% endif -%}
  {% if argument.overridesSiblings != nil %}overridesSiblings : `{{argument.overridesSiblings}}`,{% endif -%}
  {% if argument.propagateAgreement != nil %}propagateAgreement : {{argument.propagateAgreement}},{% endif -%}
  {% if argument.linkName != nil %}linkName : `{{argument.linkName}}`,{% endif -%}
  {% if argument.listInTree != nil %}listInTree : {{argument.listInTree}},{% endif -%}
  {% if argument.question != nil %}question : `{{argument.question}}`,{% endif -%}
  {% if argument.questionSubtext != nil %}questionSubtext : `{{argument.questionSubtext}}`,{% endif -%}
  {% if argument.isCheckboxOption != nil %}isCheckboxOption : {{argument.isCheckboxOption}},{% endif -%}
  {% if argument.delegateCheckboxes != nil %}delegateCheckboxes : {{argument.delegateCheckboxes}},{% endif -%}
  {% assign len = argument.nodes | size %}
  {% if len > 0 %}subArguments: [
    {% for argument in argument.nodes %}{% include argument_node.js %}{% endfor %}
  ]{% endif -%}
},