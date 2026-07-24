# CGA Getting Started

Audience: Users new to CGA

This document walks you through creating your first bot in CGA and seeing the results of your first tests. Follow step by step, check the expected results of each step before moving on to the next step.


## Completed in this document

If you read these instructions through to the end, you will be able to:

- You can prepare the necessary information before creating a new bot.
- You can decide which NLU method to choose among ML·Semantic·LLM.
- You can check the model, response method, and support status on the creation screen.
- After creating your bot, you will know what to look for in training or indexing and first testing.

## Prepare before you start

- CGA Studio account
- Bot name to create
- A short user utterance to use for testing.
- Default choice for which NLU method to use


If you need detailed selection criteria for the engine, please first check the [NLU Utilization Guide](../cga-nlu-guide/README.md).

### Minimum preparation example for first use

Don't add a lot of functionality from the beginning, check the screen flow with one intent and short test utterances.

| Preparation items | Example |
|---|---|
| bot name | Vacation Inquiry Testbot |
| intention | Check remaining vacation days |
| Example of learning sentences | How many days are left on vacation? |
| test ignition | How much vacation is left? |
| First answer method | established answer |

The above example is intended to explain how to use the document, and is not intended to be used as actual company business data or answers.

## Step 1. Login

### Purpose

Enters the CGA Studio work screen.

### operation

1. Opens the CGA Studio login screen.
2. Enter your account information.
3. Select the Login button.

### Expected results

CGA Studio's dashboard or welcome screen appropriate for your permissions is displayed.

### If a problem occurs

If you return to the login screen or see a permission error, check your account status and roles with Operations.

## Step 2. Create a new bot

### Purpose

Enter basic information for the bot you want to test.

### operation

1. Go to the bot creation screen.
2. Select `Bot` in Bot Type.
3. Select text type or voice type.
4. You can now select a PC image in the profile area.
5. Enter the bot name in the `Enter the bot name.` field.
6. Check `Korean` in language.
7. If necessary, enter an introduction in the `Enter an introduction that describes the bot.` field.

### Expected results

The bot creation screen displays the selection status and basic information entered in the structure summary.

### If a problem occurs

If a bot name error appears, re-enter any characters that do not fit the on-screen instructions or shorten the length.

Check the following before inputting:

- How can I avoid confusing my bot name with other bots?
- Did you prepare the test utterance as one sentence?
- Did you use actual operational data or personal information to input the test?

## Step 3. Select NLU method

### Purpose

Select the engine that will interpret user utterances.

### operation

In `NLU method`, select one of the following:

- `ML`
- `Semantic - Vector Worker`
- `Semantic - External Embedding`
- `LLM Engine`

### Expected results

The NLU model and additional settings items appropriate for the selected method are displayed. For example, if you select `Semantic - External Embedding`, the embedding model and Intent Vector DB connection items will be displayed, and if you select `LLM Engine`, the Provider and detailed model items will be displayed.

### When selecting for the first time

- Review ML as a starting point for directly designing learning sentences and intents.
- If the structure uses semantic similarity and Vector DB, consider Semantic.
- Review the LLM if you are ready to operate the model with an LLM Provider.

For specific selection, refer to [Engine Comparison Table](../cga-nlu-guide/engine-comparison.md).

## Step 4. Check the model and answer method

### Purpose

Check the models and answer methods required for the selected NLU method.

### Operation

1. Check the available models in `NLU model`.
2. In `Response method`, check which items can be selected among the set answer, Semantic Engine RAG answer, LLM Engine RAG answer, and LLM Engine answer.
3. Check the support status of the selection combination.
4. When checking the settings for the first time, ensure that the combination `ML` + `DeepLearning Lite` + `Fixed response` is displayed as `Ready to run/train`.

### Expected results

The structure summary shows language, NLU method, NLU model, answer method, LLM, and version.

### If a problem occurs

If a combination is marked as unavailable, choose another answer method or NLU method. We will not proceed with your creation without checking your application status.

## Step 5. Minimum preparation for each engine

Preparations from this stage will vary depending on the engine selected.

### M.L.

Prepare intent and learning sentences. Write so that each utterance contains only one intention, and prepare distinct expressions for similar intentions.

First, prepare only one intent and a few learning sentences and check the screen flow, then check whether it was successful and expand the scope.

### Semantic

Prepare the intention or search target knowledge and Vector DB connection conditions. If you choose external embedding, check the search API address and embedding model compatibility conditions.

### L.L.M.

Select the LLM Provider and detailed model, and prepare model call addresses and reply directives if necessary.

Detailed data creation and quality improvement for each engine are covered in the corresponding chapter of the [NLU Utilization Guide](../cga-nlu-guide/README.md).

## Step 6. Creation, learning, index preparation

### Purpose

Prepares the entered bot settings and data for use in CGA.

### operation

1. Recheck the input values and engine combination.
2. Select the `Confirm` button on the creation screen.
3. Check the creation result and version status.
4. Run any training or index preparation jobs required for the selected engine.
5. Verify that the status has changed to Completed or Available.

### Expected results

The bot and version are created, and the readiness status is displayed for the selected engine.


### When learning completion is not confirmed

If the learning button changes to `Training` and then after refreshing it shows `Train` and `Untrained` again, the learning is not successful. We check the completion time and status in the training history inquiry, and if there are no results, we do not use the simulator test as a quality check.

## Step 7. first test

### Purpose

Ensure that user utterances are processed through the selected engine.

### Operation

1. Go to the version work screen for the bot you created.
2. Open the simulator.
3. Enter the short test utterance you prepared.
4. Run the test.

### Expected results

The response and classification results are displayed.

### If a problem occurs


Narrow the scope in the following order:

1. Verifies that the currently selected bot and version are eligible for testing.
2. Check the combination status of NLU method, model, and answer method.
3. Check training or index readiness status and error messages.
4. Re-enter the representative utterance and other variant utterances, respectively.
5. If the failure continues, the bot, version, engine, firing, and error time are recorded and delivered to the operation manager.

## Step 8. Check results and learn next

After the first test, check the results on the next screen.

- Simulator: Input utterance and immediate response
- Analysis: Cumulative classification results and application steps
- Evaluation: Evaluation data and results
- Conversation history: Saved conversation history

If the results are insufficient, check the NLU utilization guide for data improvement and revalidation procedures for each engine.

## Next document

- [View all CGA manuals](../README.md)
- [CGA User Manual](../cga-user-manual/README.md)
- [CGA NLU Utilization Guide](../cga-nlu-guide/README.md)
