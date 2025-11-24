# New output format


{
  "must_obey": true,
  "current_step": {
    "uri": "kairos://mem/{memory.uuid}",
    "content": "{memory.text}",
    "mimeType": "text/markdown"
  },
  "next_step": {
    "uri": "kairos://mem/${nextInfo.uuid}",
    "position": "${memory.chain.step_index + 1}/${memory.chain.step_count}",
    "label": "nextInfo.label"
  },
  "protocol_status": "continue"
}

last?

{
  "must_obey": true,
  "current_step": {
    "uri": "kairos://mem/{memory.uuid}",
    "content": "{memory.text}",
    "mimeType": "text/markdown"
  },
  "next_step": null,
  "protocol_status": "completed"
}


