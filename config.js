// config.js
const CONFIG = {
    // تم حذف whatsAppNumber من هنا لأنه أصبح يُدار من لوحة التحكم
    notificationMessages: [ // Array of messages for the marquee
        "جميع خدماتنا متاحة عقب صلاه الظهر وحتى الثانية صباحاً وتتم في خلال دقائق ⏳",
        "تم تخفيض سعر شحن بطاقة RedotPay وبطاقة MuseWallet وإيداع Binance لـ 50.5 جنيه فقط بدلاً من 51 جنيه 🔥🔥",
        "هذا الموقع هو الطريقة الرسمية الوحيدة لتعاملاتنا والهدف هو الحد من الاحتيال والإعلانات غير الموثوقة."
    ],
    animationDurationPerMessage: 20, // seconds for each message in marquee

    paymentMethods: {
        // EGP Methods
        instapay: {
            name: "Instapay",
            type: "EGP",
            recipientInfo: "me.ma7moud@instapay",
            recipientType: "اليوزر", // For display on exchange.html when this is the SEND method
            userIdentifierType: "اليوزر", // For display on exchange.html for what user needs to send in chat (RECEIVE method)
            minAmount: 25,
            requiresWholeNumber: true
        },
        telda: {
            name: "Telda",
            type: "EGP",
            recipientInfo: "01092222904",
            recipientType: "الرقم",
            userIdentifierType: "اليوزر",
            minAmount: 25,
            requiresWholeNumber: true
        },
        yellow_card: {
            name: "Yellow Card",
            type: "EGP",
            recipientInfo: "01092222904",
            recipientType: "الرقم",
            userIdentifierType: "الرقم",
            minAmount: 25,
            requiresWholeNumber: true
        },
        nexta: {
            name: "Nexta",
            type: "EGP",
            recipientInfo: "01092222904",
            recipientType: "الرقم",
            userIdentifierType: "الرقم",
            minAmount: 25,
            requiresWholeNumber: true
        },
        wallet: { // Vodafone Cash, Etisalat Cash etc.
            name: "Wallet (محفظة)",
            type: "EGP",
            recipientInfo: "01092222904",
            recipientType: "الرقم",
            userIdentifierType: "الرقم",
            minAmount: 25,
            requiresWholeNumber: true
        },
        // USDT Methods
        redotpay: {
            name: "RedotPay",
            type: "USDT",
            recipientInfo: "1461251961",
            recipientType: "الـID",
            userIdentifierType: "الـID",
            minAmount: 0.5,
            requiresWholeNumber: false
        },
        musewallet: {
            name: "MuseWallet",
            type: "USDT",
            recipientInfo: "666628",
            recipientType: "الـID",
            userIdentifierType: "الـID",
            minAmount: 0.5,
            requiresWholeNumber: false
        },
        binance: {
            name: "Binance",
            type: "USDT",
            // Binance is usually a destination, so recipientInfo might not be needed if *sending* from Binance
            // If this site allows sending *from* Binance, add recipientInfo (e.g., your Binance Pay ID)
            recipientInfo: "1461251961", // Example: Your Binance Pay ID if people send TO you on Binance
            recipientType: "الـID",
            userIdentifierType: "الـID", // User provides their Binance ID/UID
            minAmount: 0.5,
            requiresWholeNumber: false
        }
    },

    // Defines which methods can be selected in "You Get" based on "You Send"
    allowedExchanges: {
        instapay: ["redotpay", "musewallet", "binance"],
        telda: ["redotpay", "musewallet", "binance"],
        yellow_card: ["redotpay", "musewallet", "binance"],
        nexta: ["redotpay", "musewallet", "binance"],
        wallet: ["redotpay", "musewallet", "binance"],
        redotpay: ["instapay", "telda", "yellow_card", "nexta", "wallet", "musewallet", "binance"],
        musewallet: ["instapay", "telda", "yellow_card", "nexta", "wallet", "redotpay", "binance"],
        // If Binance can be a "send" option:
        // binance: ["instapay", "telda", "yellow_card", "nexta", "wallet", "redotpay", "musewallet"],
    },

    // Rates and calculation logic
    // sendAmount is the amount the user inputs in the "You Send" field
    // receiveAmount is the amount the user inputs in the "You Get" field
    calculate: function(sendMethodKey, receiveMethodKey, amount, calculationSource) {
        const sendMethod = this.paymentMethods[sendMethodKey];
        const receiveMethod = this.paymentMethods[receiveMethodKey];

        if (!sendMethod || !receiveMethod || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
            return 0;
        }

        let result = 0;

        if (calculationSource === 'send') { // Calculate "You Get" based on "You Send"
            const sendAmount = parseFloat(amount);
            // Scenario 1: Sending USDT, Receiving EGP
            if (sendMethod.type === "USDT" && receiveMethod.type === "EGP") {
                if (["instapay", "telda"].includes(receiveMethodKey)) {
                    result = sendAmount * 49.5;
                } else if (["nexta", "yellow_card"].includes(receiveMethodKey)) {
                    result = sendAmount * 49.75;
                } else if (receiveMethodKey === "wallet") {
                    result = (sendAmount * 50) - 1;
                }
            }
            // Scenario 2: Sending EGP, Receiving USDT
            else if (sendMethod.type === "EGP" && receiveMethod.type === "USDT") {
                if (sendMethodKey === "wallet") { // Special fee for wallet
                    result = (sendAmount * (1 - 0.0057)) / 50.5;
                } else {
                    result = sendAmount / 50.5;
                }
            }
            // Scenario 3: Sending USDT, Receiving USDT (e.g., RedotPay to Binance)
            else if (sendMethod.type === "USDT" && receiveMethod.type === "USDT") {
                if (sendMethodKey !== receiveMethodKey) { // Fee if different platforms
                    const fee = Math.max(sendAmount * 0.01, 0.5); // 1% or 0.5 USDT, whichever is greater
                    result = sendAmount - fee;
                } else {
                    result = sendAmount; // No change if same platform (though this case should be disallowed by UI)
                }
            }
            // Add other scenarios if EGP to EGP is allowed (currently not in allowedExchanges)
        }
        else if (calculationSource === 'receive') { // Calculate "You Send" based on "You Get"
            const receiveAmount = parseFloat(amount);
            // Scenario 1: Want to GET EGP, by SENDING USDT
            if (sendMethod.type === "USDT" && receiveMethod.type === "EGP") {
                if (["instapay", "telda"].includes(receiveMethodKey)) {
                    result = receiveAmount / 49.5;
                } else if (["nexta", "yellow_card"].includes(receiveMethodKey)) {
                    result = receiveAmount / 49.75;
                } else if (receiveMethodKey === "wallet") {
                    result = (receiveAmount + 1) / 50;
                }
            }
            // Scenario 2: Want to GET USDT, by SENDING EGP
            else if (sendMethod.type === "EGP" && receiveMethod.type === "USDT") {
                if (sendMethodKey === "wallet") {
                    result = (receiveAmount * 50.5) / (1 - 0.0057);
                } else {
                    result = receiveAmount * 50.5;
                }
            }
            // Scenario 3: Want to GET USDT, by SENDING USDT
            else if (sendMethod.type === "USDT" && receiveMethod.type === "USDT") {
                 if (sendMethodKey !== receiveMethodKey) {
                    // Reversing "sendAmount - Math.max(sendAmount * 0.01, 0.5)" is complex.
                    // We need to solve for x in: x - max(0.01x, 0.5) = receiveAmount
                    // Case 1: 0.01x >= 0.5  => x >= 50. Then x - 0.01x = receiveAmount => 0.99x = receiveAmount => x = receiveAmount / 0.99
                    // Case 2: 0.01x < 0.5   => x < 50.  Then x - 0.5 = receiveAmount => x = receiveAmount + 0.5
                    // Check consistency:
                    let potentialX_case1 = receiveAmount / 0.99;
                    let potentialX_case2 = receiveAmount + 0.5;

                    if (potentialX_case1 >= 50) { // If derived x from case 1 is consistent with case 1's assumption
                        // And if derived x from case 2 is NOT consistent with case 2's assumption (or less preferable)
                        if (potentialX_case2 < 50 && (potentialX_case1 * 0.01 >= 0.5) ) {
                             result = potentialX_case1;
                        } else if (potentialX_case2 < 50) { // Both might be valid in some ranges, prefer the one that matches the fee condition
                            result = potentialX_case2; // Default to this if case 1 condition isn't strongly met
                        } else {
                             result = potentialX_case1;
                        }
                         // A simpler approximation for reverse if perfect is too hard:
                         // result = receiveAmount / 0.99; // Assuming 1% fee was dominant
                         // Or result = receiveAmount + 0.5; // Assuming 0.5 USDT fee was dominant
                         // The user request was to truncate, not round. The above calculation is for the original amount.
                         // This reverse calc might be slightly off due to the Math.max complexity.
                         // For this specific logic, if receiveAmount + 0.5 results in a sendAmount where 0.01*sendAmount < 0.5, it's likely correct.
                         // Otherwise, receiveAmount / 0.99 is likely correct.
                        if ((receiveAmount + 0.5) * 0.01 < 0.5) {
                            result = receiveAmount + 0.5;
                        } else {
                            result = receiveAmount / 0.99;
                        }

                    } else { // potentialX_case1 < 50
                        result = potentialX_case2;
                    }
                } else {
                    result = receiveAmount;
                }
            }
        }
        // Truncate to 2 decimal places and ensure two decimal places in string (e.g., 5.7 -> 5.70)
        if (result <= 0) return "0.00"; // Avoid negative or NaN results from complex reverse calcs
        const truncatedValue = Math.trunc(result * 100) / 100;
        return truncatedValue.toFixed(2);
    }
};