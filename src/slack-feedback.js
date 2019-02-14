import React from 'react'
import PropTypes from 'prop-types'
import { ThemeProvider } from 'styled-components'
import cx from 'classnames'
import merge from 'lodash.merge'

import defaultTranslations from './translations'

import SlackIcon from './slack-icon'
import {
  Checkbox,
  CheckboxContainer,
  CheckboxLabel,
  CloseButton,
  Container,
  Content,
  FormElement,
  Header,
  ImagePreview,
  ImageUpload,
  Label,
  Loader,
  PreviewOverlay,
  SlackFeedback as StyledSlackFeedback,
  SubmitButton,
  Tabs,
  Trigger,
  UploadButton
} from './styles'

import defaultTheme from './themes/default'

const BUG = 'bug'
const IMPROVEMENT = 'improvement'
const FEATURE = 'feature'

class SlackFeedback extends React.Component {
  constructor(props) {
    super(props)

    this.state = {
      active: true,
      sendURL: true,
      sending: false,
      sent: false,
      error: false,
      uploadingImage: false,
      selectedType: props.defaultSelectedType || this.feedbackTypes[0].value,
      image: {},
      message: ''
    }

    // Create reference to container
    this.SlackFeedback = React.createRef()
  }

  translate = key => {
    const { translations } = this.props

    return typeof translations === 'object' && key in translations
      ? translations[key]
      : ''
  }

  get feedbackTypes() {
    return Object.assign(
      [],
      [
        { value: BUG, label: this.translate('feedback.type.bug') },
        {
          value: IMPROVEMENT,
          label: this.translate('feedback.type.improvement')
        },
        { value: FEATURE, label: this.translate('feedback.type.feature') }
      ],
      this.props.feedbackTypes
    )
  }

  handleChange = key => event =>
    this.setState({
      [key]: event.target.value
    })

  toggle = () => {
    if (this.state.active) {
      this.close()
    } else {
      this.activate()
    }
  }

  activate = () => {
    this.setState(
      ({ active }) => ({
        active: !active
      }),
      this.props.onOpen
    )

    document.addEventListener('click', this.handleClickOutside)
  }

  handleClickOutside = event => {
    if (event.defaultPrevented) return

    if (
      this.SlackFeedback &&
      this.SlackFeedback.current &&
      !this.SlackFeedback.current.contains(event.target)
    ) {
      this.close()
    }
  }

  close = () => {
    this.setState(
      {
        active: false
      },
      () => {
        this.props.onClose()
      }
    )

    document.removeEventListener('click', this.handleClickOutside)
  }

  toggleSendURL = () => {
    this.setState(({ sendURL }) => ({
      sendURL: !sendURL
    }))
  }

  selectType = type => () =>
    this.setState({
      selectedType: type
    })

  resetSentState = () => {
    this.message.value = ''
    setTimeout(() => {
      this.setState({ sent: false })
    }, this.props.sentTimeout)
  }

  sent = () => {
    this.setState(
      {
        sending: false,
        sent: true,
        image: {},
        error: false
      },
      this.resetSentState
    )
  }

  error = err =>
    this.setState(
      {
        sending: false,
        error: this.determineErrorType(err)
      },
      () => {
        setTimeout(() => {
          this.setState({ error: null })
        }, this.props.errorTimeout)
      }
    )

  determineErrorType = err => {
    if (!err) return this.translate('error.unexpected')

    if (typeof err === 'string') return err

    switch (err.status) {
      case 400:
        return this.translate('error.badrequest')
      case 403:
        return this.translate('error.forbidden')
      case 404:
        return this.translate('error.notfound')
      case 410:
        return this.translate('error.archived')
      case 500:
        return this.translate('error.internal')
      default:
        return this.translate('error.unexpected')
    }
  }

  send = () => {
    const { selectedType, sendURL, image } = this.state
    let text = this.state.message
    let level = 'warning'

    this.setState({ sending: true })

    // Attach the curent URL
    if (sendURL) text += `\n <${document.location.href}>`

    // Slack accepts 3 color levels: danger (red), good (green) and warning (orange)
    switch (selectedType) {
      case BUG:
        level = 'danger'
        break
      case FEATURE:
        level = 'good'
        break
      case IMPROVEMENT:
        return level
      default:
        return level
    }

    const payload = {
      channel: this.props.channel,
      username: this.props.user,
      icon_emoji: this.props.emoji,
      attachments: [
        {
          fallback: `Feedback (${selectedType})`,
          author_name: this.props.user,
          color: level,
          title: selectedType,
          title_link: document.location.href,
          text,
          footer: 'React Slack Feedback'
        }
      ]
    }

    // Attach the image (if available)
    if (image.url) payload.attachments[0].image_url = image.url

    // Submit the payload
    this.props.onSubmit(payload)
  }

  attachImage = event => {
    const { files } = event.target

    const file = files[0]
    file.preview = window.URL.createObjectURL(file)

    this.setState(
      {
        image: file,
        uploadingImage: true
      },
      () => {
        this.props.onImageUpload.call(this, file)
      }
    )
  }

  uploadError = err => {
    let errorMessage = this.translate('error.upload')

    if (err && typeof err === 'string') {
      errorMessage = err
    }

    this.setState(
      {
        uploadingImage: false,
        error: errorMessage
      },
      () => {
        this.removeImage()

        setTimeout(() => {
          this.setState({ error: null })
        }, this.props.errorTimeout)
      }
    )
  }

  imageUploaded = url => {
    if (typeof url !== 'string') {
      console.error(
        '[SlackFeedback] `url` argument in `imageUploaded` method must be a string'
      )
      this.removeImage()
      return
    }

    // Merge the image URL with the file object,
    // the resulting object will contain only the preview and the URL.
    // Any file information will be lost
    this.setState(({ image }) => ({
      uploadingImage: false,
      image: {
        ...image,
        url
      }
    }))
  }

  renderImageUpload = () => {
    if (this.state.image.preview) {
      return this.renderImagePreview()
    }

    return (
      <ImageUpload>
        <UploadButton htmlFor="imageUpload">
          {this.translate('upload.text')}
        </UploadButton>

        <FormElement
          as="input"
          type="file"
          id="imageUpload"
          accept="image/*"
          onChange={event => this.attachImage(event)}
        />
      </ImageUpload>
    )
  }

  removeImage = event => {
    if (event) event.preventDefault()

    this.setState({
      image: {},
      uploadingImage: false
    })
  }

  renderImagePreview = () => {
    const { image, uploadingImage } = this.state

    if (!image.preview) return null

    return (
      <ImagePreview
        style={{
          backgroundImage: `url(${image.preview})`
        }}
      >
        {uploadingImage ? (
          <Loader />
        ) : (
          <PreviewOverlay>
            <span onClick={this.removeImage}>
              {this.translate('image.remove')}
            </span>
          </PreviewOverlay>
        )}
      </ImagePreview>
    )
  }

  render() {
    // Return nothing if the component has been disabled
    if (this.props.disabled) return null

    const {
      active,
      sending,
      sent,
      error,
      sendURL,
      selectedType,
      uploadingImage
    } = this.state

    const { channel } = this.props

    // Do not show channel UI if no channel defined
    const showChannel = Boolean(channel) && this.props.showChannel

    let submitText = this.translate('submit.text')

    if (sent) submitText = this.translate('submit.sent')
    if (sending && !sent) submitText = this.translate('submit.sending')
    if (error) submitText = error

    const theme = merge({}, defaultTheme, this.props.theme)

    return (
      <ThemeProvider theme={theme}>
        <StyledSlackFeedback
          ref={this.SlackFeedback}
          className={cx({ active })}
        >
          <Container className={cx('fadeInUp', { active })}>
            <Header>
              {this.props.showSlackIcon ? <SlackIcon /> : null}{' '}
              {this.translate('header.title')}
              <CloseButton className="close" onClick={this.close}>
                {this.translate('close')}
              </CloseButton>
            </Header>

            <Content>
              {showChannel && (
                <span id="channel">
                  <Label htmlFor="channel">
                    {this.translate('label.channel')}
                  </Label>
                  <FormElement disabled as="input" value={this.props.channel} />
                </span>
              )}

              <Label>{this.translate('label.type')}</Label>
              <Tabs>
                {this.feedbackTypes.map(type => (
                  <li
                    key={type.value}
                    className={cx({
                      selected: selectedType === type.value
                    })}
                    title={type.label}
                    onClick={this.selectType(type.value)}
                  >
                    {type.label}
                  </li>
                ))}
              </Tabs>

              <Label>{this.translate('label.message')}</Label>
              <FormElement
                as="textarea"
                name="message"
                value={this.state.message}
                placeholder={this.translate('placeholder')}
                onChange={this.handleChange('message')}
              />

              {/* Only render the image upload if there's callback available  */}
              {this.props.onImageUpload ? this.renderImageUpload() : null}

              <CheckboxContainer>
                <Checkbox
                  id="sendURL"
                  type="checkbox"
                  checked={sendURL}
                  onChange={this.toggleSendURL}
                />
                <CheckboxLabel htmlFor="sendURL">
                  {this.translate('checkbox.option')}
                </CheckboxLabel>
              </CheckboxContainer>

              <SubmitButton
                disabled={sending || uploadingImage || !this.state.message}
                className={cx({
                  sent,
                  error
                })}
                onClick={this.send}
              >
                {submitText}
              </SubmitButton>
            </Content>
          </Container>

          <Trigger className={cx({ active })} onClick={this.toggle}>
            {this.props.showSlackIcon ? <SlackIcon /> : null}{' '}
            {this.translate('trigger.text')}
          </Trigger>
        </StyledSlackFeedback>
      </ThemeProvider>
    )
  }
}

SlackFeedback.propTypes = {
  channel: PropTypes.string,
  user: PropTypes.string,
  disabled: PropTypes.bool,
  emoji: PropTypes.string,
  showSlackIcon: PropTypes.bool,
  defaultSelectedType: PropTypes.string,
  feedbackTypes: PropTypes.arrayOf(
    PropTypes.shape({
      value: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired
    })
  ),
  showChannel: PropTypes.bool,
  errorTimeout: PropTypes.number,
  sentTimeout: PropTypes.number,
  onSubmit: PropTypes.func.isRequired,
  theme: PropTypes.object,
  onOpen: PropTypes.func,
  onClose: PropTypes.func,
  onImageUpload: PropTypes.func.isRequired,
  translations: PropTypes.object
}

SlackFeedback.defaultProps = {
  channel: '',
  user: 'Unknown User',
  disabled: false,
  showSlackIcon: true,
  emoji: ':speaking_head_in_silhouette:',
  showChannel: true,
  defaultSelectedType: null,
  feedbackTypes: [],
  errorTimeout: 8 * 1000,
  sentTimeout: 5 * 1000,
  theme: defaultTheme,
  onOpen: () => {},
  onClose: () => {},
  translations: defaultTranslations
}

SlackFeedback.defaultTheme = defaultTheme
SlackFeedback.SlackIcon = SlackIcon

export default SlackFeedback