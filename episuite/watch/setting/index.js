AppSettingsPage({
  state: {
    serverUrl: '',
    saved: false
  },

  build(props) {
    this.state.serverUrl = props.settingsStorage.getItem('serverUrl') || ''

    return Section({
      title: 'EpiBlock Server',
      style: { padding: '16px' },
      children: [
        TextInput({
          placeholder: 'http://192.168.1.100:3001',
          value: this.state.serverUrl,
          onChange: (value) => {
            this.state.serverUrl = value
            this.state.saved = false
          },
          style: {
            fontSize: '14px',
            padding: '12px',
            borderRadius: '8px',
            border: '1px solid #334155',
            background: '#0f172a',
            color: '#e2e8f0',
            width: '100%',
            marginBottom: '12px'
          }
        }),
        Button({
          label: 'Save',
          style: {
            fontSize: '14px',
            padding: '12px 24px',
            borderRadius: '8px',
            background: '#22d3ee',
            color: '#0f172a',
            fontWeight: 'bold',
            width: '100%',
            marginBottom: '8px'
          },
          onClick: () => {
            props.settingsStorage.setItem('serverUrl', this.state.serverUrl)
            this.state.saved = true
            this.build(props)
          }
        }),
        this.state.saved
          ? Text({ style: { color: '#22d3ee', fontSize: '12px', marginTop: '8px' }, text: 'Saved!' })
          : Text({ style: { color: '#64748b', fontSize: '12px', marginTop: '8px' }, text: 'Enter your EpiBlock server URL (e.g. http://192.168.1.100:3001)' })
      ]
    })
  }
})
