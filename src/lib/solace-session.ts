import solace from 'solclientjs';

const factoryProps = new solace.SolclientFactoryProperties();
factoryProps.profile = solace.SolclientFactoryProfiles.version10;
solace.SolclientFactory.init(factoryProps);

type SolaceSessionProps = {
  url: string;
  username: string;
  password: string;
  vpn: string;
  connectRetries?: number;
  connectRetriesPerHost?: number;
  reconnectRetries?: number;
  reconnectRetryWaitInMsecs?: number;
};

class SolaceSession {
  private session: solace.Session | null;

  constructor() {
    this.session = null;

    // Initialize factory with the most recent API defaults

    const factoryProps = new solace.SolclientFactoryProperties();
    factoryProps.profile = solace.SolclientFactoryProfiles.version10;
    solace.SolclientFactory.init(factoryProps);
    solace.SolclientFactory.setLogLevel(solace.LogLevel.WARN);
  }

  log(line: any) {
    const now = new Date();
    const time = [
      ('0' + now.getHours()).slice(-2),
      ('0' + now.getMinutes()).slice(-2),
      ('0' + now.getSeconds()).slice(-2),
    ];
    const timestamp = '[' + time.join(':') + '] ';

    console.log(timestamp + line);
  }

  connect(options: SolaceSessionProps) {
    this.session = solace.SolclientFactory.createSession({
      ...options,
    });
    this.session.connect();

    // Connect failure event
    this.session.on(
      solace.SessionEventCode.CONNECT_FAILED_ERROR,
      (error: any) => {
        this.log(
          'Connection failed to the message router: ' +
            error.infoStr +
            ' - check correct parameter values and connectivity!',
        );
      },
    );

    // Disconnect event
    this.session.on(solace.SessionEventCode.DISCONNECTED, () => {
      if (this.session) {
        this.log('Disconnected from the message router');
        if (this.session) {
          this.session.dispose();
          this.session = null;
        }
      }
    });

    // Connection established event
    this.session.on(solace.SessionEventCode.UP_NOTICE, () => {
      this.log('Connected to the message router');
    });
  }

  disconnect() {
    if (this.session) {
      this.session.disconnect();
      this.session = null;
      this.log('Disconnected from the message router');
    } else {
      this.log('Session is not connected');
    }
  }

  /**
   * Publish a message to a topic
   * @param topic
   * @param text
   * TODO: Need to add a checking for the session to be connected before sending
   */
  publish(topic: string, text: string) {
    if (this.session) {
      const message = solace.SolclientFactory.createMessage();

      message.setDestination(
        solace.SolclientFactory.createTopicDestination(topic),
      );
      message.setBinaryAttachment(text);
      message.setDeliveryMode(solace.MessageDeliveryModeType.DIRECT);

      this.log('Publishing message: ' + text);

      try {
        this.session.send(message);
        this.log('Message sent to topic: ' + topic);
      } catch (err) {
        this.log('Error sending message: ' + err);
      }
    } else {
      this.log('Session is not connected');
    }
  }
  /**
   * Subscribe to a topic
   * @param topic
   * TODO1: Need to add a checking for the session to be connected before subscribing
   * TODO2: How to check if already subscribed to a topic
   * if the parameters have an invalid type. Subcode: solace.ErrorSubcode.PARAMETER_INVALID_TYPE.
   * if the parameters have an invalid value. Subcode: solace.ErrorSubcode.PARAMETER_OUT_OF_RANGE.
   * if the topic has invalid syntax. Subcode: solace.ErrorSubcode.INVALID_TOPIC_SYNTAX.
   * if there's no space in the transport to send the request. Subcode: solace.ErrorSubcode.INSUFFICIENT_SPACE. See: solace.SessionEventCode#event:CAN_ACCEPT_DATA.
   * if the topic is a shared subscription and the peer router does not support Shared Subscriptions. Subcode: solace.ErrorSubcode.SHARED_SUBSCRIPTIONS_NOT_SUPPORTED.
   * if the topic is a shared subscription and the client does not allowed Shared Subscriptions. Subcode: solace.ErrorSubcode.SHARED_SUBSCRIPTIONS_NOT_ALLOWED.
   *
   */
  subscribe(topic: string) {
    if (this.session) {
      this.session.subscribe(
        solace.SolclientFactory.createTopicDestination(topic),
        true,
        topic,
        10000,
      );

      // subscribe successful event
      this.session.on(solace.SessionEventCode.SUBSCRIPTION_OK, (event) => {
        this.log('Subscription successful to topic: ' + event.correlationKey);
      });

      // subscribe failed event
      this.session.on(solace.SessionEventCode.SUBSCRIPTION_ERROR, (event) => {
        this.log('Subscription failed to topic: ' + event);
      });

      // the session is disposed or disconnected.
      this.session.on(solace.ErrorSubcode.INVALID_OPERATION, (event) => {
        this.log('Error: The session is disposed or disconnected. ' + event);
      });

      // message listener
      this.session.on(
        solace.SessionEventCode.MESSAGE,
        (message: solace.Message) => {
          const text = message.getBinaryAttachment();
          const details = message.dump();

          this.log('Received message: ' + text + ' details: ' + details);
        },
      );
    }
  }

  unsubscribe(topic: string) {
    if (this.session) {
      this.session.unsubscribe(
        solace.SolclientFactory.createTopicDestination(topic),
        true,
        topic,
        10000,
      );
      this.log('Unsubscribed from topic: ' + topic);
    } else {
      this.log('Session is not connected');
    }
  }

  startConsume(queueName: string, type: solace.QueueType) {}
}
