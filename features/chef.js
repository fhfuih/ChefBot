const { Botkit, BotkitConversation } = require('botkit');
const { v4 } = require('uuid')

const initState = {
    dishes: [],
};

const noop = () => { };

const defaultRepeat = {
    default: true,
    handler: async (response_text, dialog, bot, full_message) => {
        await bot.say('I do not understand.');
        // start over!
        return await dialog.repeat();
    }
}

/**
 * @param {BotkitConversation} dialog
 * @param {string[]} details
 */
const confirmNext = (dialog, details, add_in_id) => {
    dialog.ask(details
        ? {
            text: 'Say anything to proceed to the next step, or tell me if you want to see more details.',
            quick_replies: [
                {
                    title: 'Next step.',
                    payload: 'Next step.',
                },
                {
                    title: 'Show me more details',
                    payload: 'Show me more details',
                }
            ],
        }
        : 'Say anything to proceed to the next step',
        [
            ...(details ? [{
                pattern: /detail|how|what/,
                type: 'string',
                handler: async (response_text, convo, bot, full_message) => {
                    const { has_shown } = convo.vars
                    if (has_shown) {
                        await bot.say('Details are already shown above.');
                    } else {
                        convo.setVar('has_shown', true)
                        for (const line of details) {
                            await bot.say(line)
                        }
                    }
                    await convo.repeat();
                },
            }] : []),
            ...(add_in_id ? [{
                pattern: 'add',
                type: 'string',
                handler: async (response_text, convo, bot, full_message) => {
                    convo.setVar('has_shown', false)
                    await bot.beginDialog(add_in_id)
                },
            }] : []),
            {
                pattern: /retry|restart|overcook|screw|fail/i,
                type: 'string',
                handler: async (response_text, convo, bot, full_message) => {
                    convo.setVar('has_shown', false)
                    const id = bot.getActiveDialog().id
                    await bot.cancelAllDialogs();
                    await bot.replaceDialog(id);
                }
            },
            {
                pattern: 'abort',
                handler: async (response_text, convo, bot, full_message) => {
                    convo.setVar('has_shown', false)
                    await bot.cancelAllDialogs();
                },
            },
            {
                pattern: /next|continue/i,
                handler: async (response_text, convo, bot, full_message) => {
                    convo.setVar('has_shown', false)
                },
            },
            {
                default: true,
                handler: async (response_text, convo, bot, full_message) => {
                    await bot.say('I don\'t understand.')
                    await convo.repeat();
                },
            },
        ]
    );
}

/**
 * @param {Botkit} controller 
 */
const createDialog = controller => {
    const DIALOG = new BotkitConversation('chef', controller)
    const state = { ...initState }


    const dialog_dish_choosing = new BotkitConversation('DIALOG_DISH_CHOOSING', controller);
    const dialog_dish_search = new BotkitConversation('DIALOG_DISH_SEARCH', controller);
    const dialog_soup_search = new BotkitConversation('DIALOG_SOUP_SEARCH', controller);
    const dialog_buy = new BotkitConversation('DIALOG_BUY', controller);
    const dialog_cook = new BotkitConversation('DIALOG_COOK', controller);
    const dialog_add_in = new BotkitConversation('DIALOG_ADD_IN', controller);
    const dialog_cook_v2 = new BotkitConversation('DIALOG_COOK_V2', controller);


    DIALOG.say('Good day! What do you want to cook?')
    controller.hears(['want', 'would like', 'd like', 'chef'], 'message', async (bot, message) => {
        Object.assign(state, initState);
        await bot.beginDialog(DIALOG.id);
    });

    dialog_dish_choosing.ask(`You can tell me dish names, or I can offer some recommendations if you have no idea.

Also, tell me when you are done selecting dishes.`, [
        {
            pattern: /done|that|it|all|finish|end|quit/i,
            type: 'string',
            handler: async (response_text, convo, bot, full_message) => {
                await bot.replaceDialog(dialog_buy.id)
            }
        },
        {
            pattern: /help|please|no|idea/i,
            type: 'string',
            handler: async (response_text, convo, bot, full_message) => {
                await bot.say('Don\'t worry. Below are some good choices for you.')
                await bot.replaceDialog(dialog_dish_search.id)
            }
        },
        {
            pattern: 'soup',
            type: 'string',
            handler: async (response_text, convo, bot, full_message) => {
                await bot.replaceDialog(dialog_soup_search.id)
            }
        },
        {
            default: true,
            handler: async (response_text, convo, bot, full_message) => {
                await bot.replaceDialog(dialog_dish_search.id)
            }
        }
    ], {});

    dialog_dish_search.ask({
        text: `Here are the search results

Also, tell me when you are done selecting dishes.`,
        quick_replies: [
            {
                title: 'Mapo Tofu',
                payload: 'Mapo Tofu',
                image: 'https://st-cn.meishij.net/r/10/120/30010/s30010_160376728420063.jpg',
                disabled: true,
            },
            {
                title: 'Pork Stir-Fry w/ Green Peppers',
                payload: 'Pork Stir-Fry with Green Peppers',
                image: 'https://st-cn.meishij.net/r/195/139/8972445/s8972445_148117737119107.jpg',
            },
            {
                title: 'Scipy Crab',
                payload: 'Scipy Crab',
                image: 'https://st-cn.meishij.net/r/190/82/8520690/s8520690_148335337737830.jpg',
                disabled: true,
            },
            {
                title: 'Beef Stew w/ Radish & Fried Tofu',
                payload: 'Beef Stew w/ Radish & Fried Tofu',
                image: 'https://st-cn.meishij.net/r/246/137/1534496/s1534496_160381181903517.jpg',
                disabled: true,
            },
        ],
    }, [
        {
            pattern: /pork|pepper/i,
            type: 'string',
            handler: async (response_text, convo, bot, full_message) => {
                await bot.say('OK. You have selected 青椒肉絲 (Pork Stir-Fry w/ Green Peppers)');
                await bot.say('Got it. What\'s next?')
                await bot.replaceDialog(dialog_dish_choosing.id)
            }
        },
        {
            pattern: 'soup',
            type: 'string',
            handler: async (response_text, convo, bot, full_message) => {
                await bot.replaceDialog(dialog_soup_search.id)
            }
        },
        {
            pattern: /done|that|it|all|finish|end|quit/i,
            type: 'string',
            handler: async (response_text, convo, bot, full_message) => {
                await bot.replaceDialog(dialog_buy.id)
            }
        },
        {
            default: true,
            handler: async (response_text, convo, bot, full_message) => {
                await convo.repeat()
            }
        },
    ]);

    dialog_soup_search.say('OK. I found some nice soup recipes.');
    dialog_soup_search.ask({
        text: `Here are the search results

Also, tell me when you are done selecting dishes.`,
        quick_replies: [
            {
                title: 'Pigeon Soup',
                payload: 'Pigeon Soup',
                image: 'https://s1.ig.meishij.net/p/20101114/9e3d3f46c7db2903afc063a20a3ebe88.jpg',
            },
            {
                title: 'Chicken Soup',
                payload: 'Chicken Soup',
                image: 'https://st-cn.meishij.net/r/67/36/4071567/s4071567_149408704392779.jpg',
                disabled: true,
            },
            {
                title: 'Fish Soup',
                payload: 'Fish Soup',
                image: 'https://st-cn.meishij.net/r/190/82/8520690/s8520690_148335337737830.jpg',
                disabled: true,
            },
            {
                title: 'Beef Stew w/ Radish & Fried Tofu',
                payload: 'Beef Stew w/ Radish & Fried Tofu',
                image: 'https://st-cn.meishij.net/r/246/137/1534496/s1534496_160381181903517.jpg',
                disabled: true,
            },
        ],
    }, [
        {
            pattern: 'pigeon',
            type: 'string',
            handler: async (response_text, convo, bot, full_message) => {
                await bot.say(`OK. You have selected 鴿子湯 (Pigeon Soup)`);
                await bot.say('Got it. What\'s next?')
                await bot.replaceDialog(dialog_dish_choosing.id)
            }
        },
        {
            pattern: /done|that|it|all|finish|end|quit/i,
            type: 'string',
            handler: async (response_text, convo, bot, full_message) => {
                await bot.replaceDialog('DIALOG_BUY')
            }
        },
        {
            default: true,
            handler: async (response_text, convo, bot, full_message) => {
                await bot.replaceDialog(dialog_dish_search.id);
            }
        }
    ]);
    controller.addDialog(dialog_dish_choosing);
    controller.addDialog(dialog_dish_search);
    controller.addDialog(dialog_soup_search);
    DIALOG.addChildDialog(dialog_dish_choosing.id);
    DIALOG.addChildDialog(dialog_dish_search.id);
    DIALOG.addChildDialog(dialog_soup_search.id);
    controller.addDialog(DIALOG)


    dialog_buy.say('Dishes all set!')
    dialog_buy.say('Here are the ingredients you need to prepare:')
    dialog_buy.say(
        `### Pigeon Soup
- Pigeons *2
- A Chineses spice that I wish I know its English name *2 pcs
- Same as above *3 pcs
- Same as above *1 pcs
- Same as above *5 pcs
- Same as above *10 pcs
- I give up *6 tbsp
### Pork Stir-Fry w/ Green Peppers
- Lean Pork *250g
- Green Peppers *150g
- Ginger *5g`
    )
    dialog_buy.ask({
        text: 'Have you prepared everything?',
        quick_replies: [
            {
                title: 'Yes.',
                payload: 'Yes.',
            },
            {
                title: 'No.',
                payload: 'No.',
            },
        ]
    }, [
        {
            pattern: 'yes',
            type: 'string',
            handler: async (response_text, convo, bot, full_message) => {
                await bot.say('OK. Wake me up when you are ready to cook!')
                await bot.cancelAllDialogs()
            }
        },
        {
            pattern: 'no',
            type: 'string',
            handler: async (response_text, convo, bot, full_message) => {
                await bot.say('OK. Take your time preparing the ingredients.')
                await bot.say('If you have any questions during the preperation, you can ask me.')
                await bot.say('Or you can wake me up when you are ready to cook.')
                await bot.cancelAllDialogs()
            }
        },
        defaultRepeat
    ])
    controller.hears('how', 'message', async (bot, message) => {
        await bot.say(`
1. Fresh red meat like lamb or beaf should be bright red.
2. Press the meat firmly with your finger. If it springs back nicely, it is fresh.
3. Fresh meat doesn\'t stink, of course.`
        )
    })
    controller.addDialog(dialog_buy);


    dialog_cook.say('Alright, let\'s do this!');
    // dialog_cook.say('You can always abort or restart the cooking session at anytime');
    dialog_cook.say(`#### Pigeon Soup

_Step 1:_ wash the spices and soak them in water for 30 minutes`)
    confirmNext(dialog_cook, [
        `![alt](https://images.meishij.net/p/20101114/b78dd6e8b197dcd80cf511494d3d2d67.jpg)`
    ]);

    dialog_cook.say(`#### Pork Stir-Fry

 _Step 1:_ chop the pork and green peppers. Mix the pork with soy sauce and starch, and place for 5 minutes.`);
    confirmNext(dialog_cook, [
        `![alt](https://st-cn.meishij.net/rs/195/139/8972445/n8972445_148117793297280.gif)`,
        'The pork chops should be around 10cm long'
    ]);

    dialog_cook.say(`#### Pigeon Soup

_Step 2:_ cut the pigeons into medium-sized dices.`)
    confirmNext(dialog_cook, [
        `![alt](https://images.meishij.net/p/20101114/59e311083e52a56c4cb985231a9244c9.jpg)`,
        'The pigeons should be cut into ~5cm dices'
    ], dialog_add_in.id);

    dialog_cook.say(`#### Pork Stir-Fry

_Step 2:_ heat the wok, add oil and then the pork when the oil is warm but not yet hot. Stir-fry until the pork is done.`);
    confirmNext(dialog_cook, [
        `![alt](https://st-cn.meishij.net/rs/195/139/8972445/n8972445_148117799214262.gif)`,
        'When the pork turns white and stiff from its original pink state, it should be done.'
    ]);

    dialog_cook.say(`#### Pork Stir-Fry

_Step 3:_ empty the pork, but leave some oil in the wok.
Add the green peppers and stir-fry until done.
Then add pork and salt and say sauce for seasoning and it is ready to serve.`);
    confirmNext(dialog_cook, [
        `![alt](https://st-cn.meishij.net/rs/195/139/8972445/n8972445_148117806308987.gif)`,
        'When the green peppers turn soft, you can add the seasonings.'
    ]);

    dialog_cook.say(`#### Pigeon Soup

_Step 3:_ Put the pigeons and the spices in the pot and fill up with water. Boil for 30 minutes.`);
    confirmNext(dialog_cook, [
        `![alt](https://images.meishij.net/p/20101114/30df562001fa681b86c5c2fa4e415e06.jpg)`
    ]);

    dialog_cook.say(`#### Pigeon Soup

_Step 4:_ Turn down the fire and simmer for 3 hours. Then it is ready to serve.`);
    confirmNext(dialog_cook, [
        `![alt](https://images.meishij.net/p/20101114/2a62cff232b59c0b19b523561a5c11b5.jpg)`
    ]);

    dialog_cook.say('You are all done! Good job!');
    controller.addDialog(dialog_cook)
    controller.hears('ready', 'message', async (bot, message) => {
        await bot.beginDialog(dialog_cook.id)
    })


    dialog_cook_v2.say(`#### Pigeon Soup

_Step 2:_ cut the pigeons into medium-sized dices.`)
    confirmNext(dialog_cook_v2, [
        `![alt](https://images.meishij.net/p/20101114/59e311083e52a56c4cb985231a9244c9.jpg)`,
        'The pigeons should be cut into ~5cm dices'
    ]);

    dialog_cook_v2.say(`#### Fried Tomatos & Eggs

_Step 1:_ cut the tomatos into dices or pieces.`)
    confirmNext(dialog_cook_v2, [
        `![alt](https://st-cn.meishij.net/rs/115/13/2253365/n2253365_30038.jpg)`,
    ]);

    dialog_cook_v2.say(`#### Fried Tomatos & Eggs

_Step 2:_ whip the eggs.`)
    confirmNext(dialog_cook_v2, [
        `![alt](https://st-cn.meishij.net/rs/115/13/2253365/n2253365_03733.jpg)`,
    ]);

    dialog_cook_v2.say(`#### Pork Stir-Fry

_Step 2:_ heat the wok, add oil and then the pork when the oil is warm but not yet hot. Stir-fry until the pork is done.`);
    confirmNext(dialog_cook_v2, [
        `![alt](https://st-cn.meishij.net/rs/195/139/8972445/n8972445_148117799214262.gif)`,
        'When the pork turns white and stiff from its original pink state, it should be done.'
    ]);

    dialog_cook_v2.say(`#### Pork Stir-Fry

_Step 3:_ empty the pork, but leave some oil in the wok.
Add the green peppers and stir-fry until done.
Then add pork and salt and say sauce for seasoning and it is ready to serve.`);
    confirmNext(dialog_cook_v2, [
        `![alt](https://st-cn.meishij.net/rs/195/139/8972445/n8972445_148117806308987.gif)`,
        'When the green peppers turn soft, you can add the seasonings.'
    ]);

    dialog_cook_v2.say(`#### Fried Tomatos & Eggs

_Step 3:_ stir-fry the eggs.`)
    confirmNext(dialog_cook_v2, [
        `![alt](https://st-cn.meishij.net/rs/115/13/2253365/n2253365_64775.jpg)`,
    ]);

    dialog_cook_v2.say(`#### Fried Tomatos & Eggs

_Step 4:_ add in tomatos and stir-fry until they are all done.`)
    confirmNext(dialog_cook_v2, [
        `![alt](https://st-cn.meishij.net/rs/115/13/2253365/n2253365_68740.jpg)`,
    ]);

    dialog_cook_v2.say(`#### Fried Tomatos & Eggs

_Step 5:_ add salt and optionally white sugar for seasoning. Then it is ready to serve!`)
    confirmNext(dialog_cook_v2, [
        `![alt](https://st-cn.meishij.net/rs/115/13/2253365/n2253365_01056.jpg)`,
    ]);

    dialog_cook_v2.say(`#### Pigeon Soup

_Step 3:_ Put the pigeons and the spices in the pot and fill up with water. Boil for 30 minutes.`);
    confirmNext(dialog_cook_v2, [
        `![alt](https://images.meishij.net/p/20101114/30df562001fa681b86c5c2fa4e415e06.jpg)`
    ]);

    dialog_cook_v2.say(`#### Pigeon Soup

_Step 4:_ Turn down the fire and simmer for 3 hours. Then it is ready to serve.`);
    confirmNext(dialog_cook_v2, [
        `![alt](https://images.meishij.net/p/20101114/2a62cff232b59c0b19b523561a5c11b5.jpg)`
    ]);

    dialog_cook_v2.say('You are all done! Good job!');
    controller.addDialog(dialog_cook_v2);


    dialog_add_in.ask('OK. What do you want to add?', noop);
    dialog_add_in.ask({
        text: 'Here are the search results',
        quick_replies: [
            {
                title: 'Fried Tomatos w/ Eggs',
                payload: 'Fried Tomatos wtih Eggs',
                image: 'https://s1.ig.meishij.net/p/20130605/ab2a8f588baa3eb3edc726d18475d86c.jpg',
            },
            {
                title: 'Steamed Eggs',
                payload: 'Steamed Eggs',
                image: 'https://st-cn.meishij.net/r/10/120/30010/a30010_156169246810515.jpg',
                disabled: true,
            },
        ]
    }, [
        {
            pattern: 'tomato',
            type: 'string',
            handler: async (response_text, convo, bot, full_message) => {
                await bot.say('Here are the additional ingredients you may need to prepare.')
                await bot.say(
                    `### Fried Tomatos w/ Eggs
- Tomatos *2
- Eggs *2`
                )
                await bot.say('_Fried Tomatos w/ Eggs_ is added to your current task flow!')
                await bot.replaceDialog(dialog_cook_v2.id);
            }
        },
        {
            pattern: /cancel|back|abort/,
            type: 'string',
            handler: async (response_text, convo, bot, full_message) => {
                await bot.say('Nothign is added. Returning to the flow.')
            }
        },
        {
            default: true,
            handler: async (response_text, convo, bot, full_message) => {
                await bot.say('I don\'t understand.')
                await convo.repeat();
            }
        }
    ])

    controller.addDialog(dialog_add_in)


    return DIALOG.id;
}

module.exports = createDialog;
