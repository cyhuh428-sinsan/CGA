# CGA Studio User Manual

Audience: General users, bot operators, system administrators

This document describes the menus and workflow of CGA Studio. If you are using it for the first time, read [CGA Getting Started](../cga-getting-started/README.md) first, and refer to [CGA NLU Utilization Guide](../cga-nlu-guide/README.md) for engine selection, learning, and quality improvement.


## 1. Starting CGA Studio

### 1.1 Login

1. Opens the CGA Studio login screen.
2. Enter your account information.
3. After logging in, go to the CGA Studio screen.


### 1.2 Notations used in documents

- `Bot`: Unit providing conversation services
- `Version`: Execution unit that manages the bot's configuration and training assets.
- `NLU method`: A method of interpreting user utterances as intent or meaning
- `Response method`: Method of generating or retrieving answers based on classification results
- `Training`: Reflecting data from the bot for ML or selected execution engine

### 1.3 Checking status on screen

The bot creation screen displays an input area as well as an area summarizing the current selection. Check the following items first:

- Language
- NLU method
- NLU model
- Response method
- LLM Provider or Model
- version

If you change the NLU method or answer method, the selectable models and additional setting items may change. Check whether the combination status of the screen is `Ready to run/train` or `Settings can only be saved` and then decide the next action. If you are using it for the first time, do not select `Confirm` without checking the combination status.

In the creation screen, `Confirm` is an action to submit the entered settings, and `Cancel` is an action to exit the creation screen. After submission, the bot creation results and learning/indexing completion status are subject to separate execution verification.

## 2. Bot creation and AI settings

On the bot creation screen, specify bot basic information and AI-related settings.

### 2.1 Basic information

The default items seen on the current screen are as follows:

- Bot Type: Bot, Bot Hub
- Bot mode: text type, voice type
- Bot Profile
- Bot Name
- Language: Current screen options are Korean
- Introduction

Enter the bot name following the on-screen instructions, observing the allowed characters and length. The profile image will be in PNG, JPEG, WEBP format and the size limit shown on the screen.

### 2.2 NLU method

The NLU methods currently available for selection on the CGA screen are as follows.

| display screen | Meaning |
|---|---|
| ML | Classification method based on learning sentences and intent |
| Semantic - Vector Worker | Semantic method using CGA's Vector Worker and Vector DB |
| Semantic - External Embedding | Semantic method connecting external embedding and Local Vector DB |
| LLM Engine | How to use the LLM model |

For engine-specific selection criteria and data preparation methods, refer to [Engine Comparison in the NLU Utilization Guide](../cga-nlu-guide/engine-comparison.md).

### 2.3 NLU model

The model list varies depending on the NLU method.

- ML: DeepLearning Lite, TF-IDF Linear, Keyword Baseline
- Semantic: Default Vector Worker model or external embedding model
- LLM: Provider selection and detailed model selection for each provider

On the LLM screen, providers such as Gemini, ChatGPT, Claude, Groq, Cerebras, Mistral, Ollama, and OpenRouter can be displayed, and the detailed model list varies depending on the selected provider. The actual available models and connection status are checked based on the selectable status on the creation screen.

### 2.4 Response method

The answer methods shown on the current screen are as follows.

- Defined answer
- Semantic Engine RAG Answer
- LLM Engine RAG Answers
- LLM Engine Answers

Combinations of NLU methods and answer methods may display support status. If the combination status shows as unavailable, don't proceed; change to a supported combination.

## 3. Bot version and workspace

After creating a bot, manage the bot and version separately.

- Bot: Basic information and operation target of service unit
- Version: A unit that manages intent, object, dictionary, dialogue design, and AI settings.
- Workspace: Screen for designing, testing, and analyzing a specific bot version.

The detailed path is checked based on the menu name of the current CGA screen.

When starting an operation, first select the bot and version, and ensure that what is displayed on the screen is what you intended. If you edit your data with a different bot or version selected, your results may vary.

### 3.1 Main access path

| work | Access route |
|---|---|
| Bot List | Studio > Bot |
| Create a new bot | Studio > Bot > Create bot |
| Bot Settings | Selected bot > Settings |
| Version list | Selected bot > Version Control |
| Version workspace | Selected bot > Version > Workspace |

First check the bot/version selection status on the screen and then modify version assets such as intent, object, dictionary, and QA.

## 4. Dialog Design Assets

### 4.1 Intent

This is a unit that distinguishes what a user utterance is requesting. The conversation flow connected to the learning sentences for each intent must be reviewed together.

The access path is `Bot > Version > Intents`. After modifying the intent data, check the training status and simulator results of that version.

### 4.2 Object

This is a unit that extracts the value or name required for business processing from an utterance. When modifying an object, check whether the associated intent and dialog flow are enabled or not.

The access path is `Bot > Version > Entities`. When changing entity names or extraction criteria, ensure that existing intents and test utterances remain valid.

### 4.3 Dictionary

Assets used to interpret domain terms, synonyms, and user expressions. The detailed principles of creating a dictionary are explained in the NLU Utilization Guide.

The access path is `Bot > Version > Dictionary`. When adding synonyms, distinguish between expressions that only affect a specific intent or expressions that are commonly used across multiple intents.

### 4.4 QA

This is the area that manages questions and answers or document-based knowledge. The upload format and document structure are first checked to see what range is supported by the actual CGA screen.

The access path is `Bot > Version > QA`. After reflecting documents or questions/answers, check whether indexing or application status is provided, and do not use the results for operations without confirmation.

### 4.5 Dialogue flow

The conversation flow is the area that organizes the process of handling a user's request by linking it to intent.

The access path is `Bot > Version > Conversation Flows`. When modifying a flow, check the following:

1. Check which intent the flow is associated with.
2. Check the order of user input and bot responses.
3. Check if any steps use objects or common variables.
4. Check the branching for termination, re-question, and exception situations.
5. After saving, test normal and exception paths separately in the simulator.

### 4.6 API

The API menu is an area that manages API information associated with the conversation handling of your bot or version.


## 5. Testing/Analysis/Evaluation

Currently, the following work screens exist in CGA for each version.

- Simulator: Screen to input utterance and check response
- Analysis: Screen to check cumulative classification results and applied classification steps
- Evaluation: Screen to check prepared evaluation data and results
- Conversation history: Screen to check actual or saved conversation results
- Retrain: Screen to reflect feedback or correction data again

The main access paths are as follows:

| work | Access route |
|---|---|
| simulator | Bot > Version > Simulator |
| analysis | Bot > Version > Analytics |
| evaluation | Bot > Version > Rating |
| conversation history | Bot > Version > Conversation History |
| Re-learning | Bot > Version > Retrain |

Exclusion/Ignore, Small Talk, Exacting Matching, Rule, ML, Semantics, LLM, etc. may be displayed in the classification stage of the analysis screen. Interpretation is based on the actual classification steps and indicators displayed on the screen.

## 6. System Management

The scope of access to the system management menu may vary depending on the role.

The current menu groups are as follows:

- User management: user management, login history, group management
- Status inquiry: operation/system log, bot status, learning history, conversation history, API call history, queue history, feedback by intent
- Conversation Management: Common Variables, Default Message
- System connection: Channel, bot station connection status
- Other Management: Templates, Licenses

The actual display name of the administrator menu is as follows.

- User management: user management, login history, group management
- Status inquiry: Operation/system log inquiry, bot status inquiry, learning history inquiry, conversation history inquiry, API call history inquiry, Queue history inquiry, feedback inquiry by intent
- Conversation Management: Managing Common Variables, Managing Basic Messages
- System connection: Channel management, bot station connection status
- Other management: template list, license lookup

### 6.1 Channels and Bot Station

- `Channel Management`: Manages channel ID, channel name, provider, renderer type, availability and connection settings.
- `Botstation connection status`: Check the linkage status of group, channel, bot, operating version, and active channel.

Before changing channels or botstations, check the target bot's operating version and active channels. If a connection test or save result fails, record the error message and destination information on the screen and forward it to operations personnel.

Detailed operations for each authority in the administrator menu are confirmed after verification by browser for each actual role.

### 6.2 KakaoTalk channel connection

To connect to KakaoTalk, you must complete Kakao developer settings, KakaoTalk channel/chatbot settings, and CGA connection information settings in order. Just registering a channel on the CGA screen does not complete the KakaoTalk connection.

> Security Caution: Authentication/connection information such as app ID, REST API key, skill URL, and operation/test headers are not recorded as actual values ​​in documents, screen captures, logs, or messengers. The actual value is confirmed by the operations staff through a safe delivery path, and only the item name and storage location are recorded in the document.

#### 6.2.1 Preparation

Verify the following information with your operations representative:

- Kakao Developers app and app ID
- KakaoTalk channel and business channel connection status
- Kakao Business Chatbot and Operation Channel
- Bots and operating versions to use in CGA
- Skill URL and Test URL issued by CGA
- Required operational and test headers

If the app ID or key is hard-coded in the document or screen, or if the versions of the operation bot and test bot are different, connection confirmation is not performed.

#### 6.2.2 Kakao Developers app settings

1. Log in to [Kakao Developers](https://developers.kakao.com/).
2. Select the app to connect from the **App** menu.
3. Check the app name and app ID.
4. If Kakao login is required in **Kakao Login > General**, set the status to `ON` and save.
5. Check the basic app information and Biz app conversion status in **Business Certification > Biz App Switching**.
6. Check application eligibility and review status in **KakaoTalk Channel > Business Channel Connection**.
7. Check the REST API key in the app settings, but do not expose the actual key value to the outside.

Business channel connections may not be available immediately depending on review status. If it's under review, record the status rather than determining that the connection is complete.


#### 6.2.3 KakaoTalk channel and chatbot settings

1. Check the channel to connect in [KakaoTalk Channel Management Center](https://center-pf.kakao.com/) or Kakao Business Management Center.
2. Ensure that the channel is discoverable and available.
3. Create a chatbot or select an existing chatbot in **Business Tools > Chatbots**.
4. Select and save the operation channel to be connected to CGA in **Settings > Select Operation Channel** of the chatbot.
5. Check that the operation channel and chatbot are connected in **Connect chatbot** in the channel dashboard.


#### 6.2.4 Skill creation and connection information input

1. Select the target chatbot in the Kakao Chatbot Management Center.
2. Select **Create New Block > Create Skill**.
3. Enter the skill name. Name it according to the operating rules and identify it as a skill for CGA connection.
4. Enter the Skill URL and Test URL issued by CGA, respectively.
5. Enter operational and test headers respectively, if necessary.
6. After saving, check the URL, Test URL, header input status and applicable blocks on the skill details screen.

The Skill URL and header use values ​​provided by CGA operations staff. Do not guess values ​​or enter production and test URLs interchangeably.

![Kakao Connect Skill details screen](screenshots/kakao-skill-detail-masked.png)

Figure 6-2-1. `CGA Kakao Connection` Skill details screen. URL and header values ​​are masked for security.

#### 6.2.5 Connecting welcome block and fallback block

1. Open the chatbot's welcome block.
2. Select CGA Connection Skill in **Parameter Settings**.
3. Select **Use skill data** in the bot response settings.
4. Save.
5. Set the same CGA connection skill and **use skill data** in the fallback block.
6. Recheck the save results and connection status for each block.

The welcome block handles the first entry into a KakaoTalk conversation, and the fallback block forwards regular utterances to the CGA. If the two blocks use different skills or different operating versions, the processing results for the initial greeting and the general response may differ.

![Kakao Welcome Block](screenshots/kakao-welcome-block.png)

Figure 6-2-2. Welcome block parameter settings and skill data usage screen.

![Kakao Fallback Block](screenshots/kakao-fallback-block.png)

Figure 6-2-3. Fallback block parameter settings and skill data use screen.

#### 6.2.6 Linking CGA channel registration and operating version

1. In CGA Studio, go to **System Management > Channel Management**.
2. Enter the channel ID and channel name to be used for KakaoTalk connection, or select an existing channel.
3. Check the provider, renderer type, availability, and connection settings.
4. Check the bot you are connecting to and its operating version.
5. After saving, check the connection status on the channel management screen.
6. Check that the combination of group, channel, bot, operating version, and active channel is correct in **Botstation connection status**.

#### 6.2.7 Check connection

1. Search for the channel connected to KakaoTalk and open the chat room.
2. Ensure that CGA's default greeting is displayed on first entry.
3. Enter the regular utterance corresponding to the registered intent.
4. Ensure that CGA's NLU classification and conversation flow results are displayed in the response.
5. Verify that user utterances and responses are saved in the CGA conversation history.
6. Check whether the channel value in the history is `Kakao` or the Kakao channel value defined in the operating environment.
7. Verify that the bot, operating version, and channel information match the intended audience.

The conditions for connection completion are as follows.

- The welcome block and fallback block call the CGA connection skill.
- Both blocks are set to use skill data.
- The first greeting and general response come from the CGA bot settings, not the Kakao settings phrase.
- Bot, version, and Kakao channel information remain in the CGA conversation history.

If connection fails, check the Kakao channel status, chatbot operation channel, skill URL/header, welcome/fallback block, CGA channel provider, and operation version in that order. Do not copy or arbitrarily change keys or headers in documents.


#### 6.2.8 CGA screen capture insertion location

The following CGA screen inserts a capture after checking the permissions and connection status of the actual operating environment.


When inserting a capture, first mask sensitive information such as account name, app ID, REST API key, skill URL, authentication header, and personal information.

## 7. Basic confirmation sequence when a problem occurs

1. Verify that the current bot and version are correct.
2. Check the combination status of the selected NLU method, model, and answer method.
3. Verify that the required data has been saved.
4. Check the training/indexing/apply status.
5. Test the same utterance again in the simulator.
6. Check the results in the analysis/evaluation/dialogue history.

If the cause and result are not confirmed on the screen, do not directly manipulate the DB or CLI, but convey the bot, version, error message, and occurrence time on the screen to the operation manager.

### In case of non-learning even after learning request

1. Press the Learn button and check whether the message `The NLU training request has been added to the queue.` is displayed.
2. Verify that the Learn button changes to `Training`.
3. After refreshing, check if the version status changes to `Training finished` or Available.
4. Check the start time, completion time, and learning status of the same bot/version in the learning history inquiry.
5. If it is displayed as `Untrained` again or there is no learning history, do not judge it as a success, but convey the bot, version, learning engine, and request time to the operation staff.

A training request is added to the Queue and processed asynchronously by a separate Worker. ML and Semantic training may take more than three minutes depending on the data and runtime environment; test only after the training history shows Success or a trained state.

## 8. Common procedures for menu operations

The following order is commonly applied when using the Intent, Object, Dictionary, QA, Dialog Flow, and API menus.

1. **Purpose**: In one sentence, define the work outcome you want to change with this task.
2. **Access Path**: Select the correct bot and version and navigate to the corresponding menu.
3. **Screen composition**: Check the current value, selection status, errors/warnings, and inactive items first.
4. **Usage Procedure**: Change only the necessary items and record the values ​​before the changes.
5. **Save/Apply Result**: Check the save message and learning/indexing/apply status.
6. **Caution**: Check the impact on the associated intent/flow/channel/version.
7. **Related Documentation**: If it is an engine or quality issue, also check the [NLU Utilization Guide](../cga-nlu-guide/README.md).

The save success message alone does not determine that the operation reflection has been completed. If you need actual usage results, check the results in the simulator, analysis, and conversation history.

## 9. Glossary

| Terminology | Description |
|---|---|
| bot | Unit of service that talks to the user |
| Bot Hub | A unit that manages multiple bots |
| version | Unit that manages bot settings and conversation design separately |
| intention | A unit that classifies the purpose of a user's request |
| object | A value or name extracted from an utterance |
| NLU | Functional area that interprets the user's natural language input |
| Learning | The task of reflecting registered data so that the engine can use it |
| Indexing | Preparing the search structure of data for retrieval |
| RAG | How to use retrieved knowledge and generative models together |

## 10. Entities and dictionaries

- Use entities for values extracted from utterances, such as dates, regions, products, or order numbers.
- Use dictionaries to normalize domain terms and synonyms. After changing either asset, retest every linked intent.
- Keep names, representative expressions, variables, and the connected dialog flow consistent.

## 11. Dialog flows and templates

1. Start from the intent and identify the first card.
2. Connect answers, conditions, API calls, variables, and the next card.
3. Create normal, exception, and termination paths, then confirm that no card is disconnected.
4. Select only active templates registered for the target channel and verify the rendered result in Bot Test and the real channel.

## 12. API management and execution

- Register the API name, destination Base URL, method, authentication, headers, path, query, and body fields.
- Browser code must call a same-origin path; internal Docker addresses and credentials remain on the server side.
- After a test, check the analysis data and **Admin > API call history** for status, latency, and failure details.

## 13. Bot Test, evaluation, retraining, and analysis

- In **Bot Test**, verify the response and the analysis panel together: applied classification stage, score, entities, variables, dialog card, and final response.
- In **Evaluation**, review misclassified utterances, low-score utterances, and similar-intent conflicts with the same baseline data set.
- In **Retraining**, reflect only validated utterances and confirm the processing result in training history.
- In **Analysis**, distinguish zero data from a filter or collection problem before changing the model.

## 14. System administration and operations dashboard

- Manage users, groups, roles, channels, botstation links, templates, licenses, and localized system messages from Admin.
- Use the operations dashboard for API/DB readiness, cache, response latency, errors, edit locks, DB separation, ML GPU, and Semantic GPU status.
- Use history screens to trace bot, version, language, utterance, channel, request time, and result; do not expose credentials or personal information.

## 15. Operator checklist and example flow

Before a change, record the bot UUID, version, language, operating version, affected assets, baseline utterances, and connected channels. After a change, verify save status, training/indexing, Bot Test, evaluation, analysis, conversation/API/Queue history, and the real channel.

Example: create a delivery inquiry bot, add schedule and current-status intents, register multilingual utterances and order-number entities, connect an API card, train or index the version, test representative and boundary utterances, and reflect only verified failures through retraining.

## Related Documents

- [View all CGA manuals](../README.md)
- [CGA Getting Started](../cga-getting-started/README.md)
- [CGA NLU Utilization Guide](../cga-nlu-guide/README.md)
