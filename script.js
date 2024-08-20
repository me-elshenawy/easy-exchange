let operationType;
    let transactionType;

    function selectOperation(type) {
        operationType = type;
        document.getElementById('transactionTypeDiv').style.display = 'block';
    }

    function selectTransaction(type) {
        transactionType = type;
        document.getElementById('amountDiv').style.display = 'block';
        
        let promptText = "";
        if (operationType === 1) { // سحب
            if (transactionType === 1) { // أريد دفع
                promptText = "برجاء ذكر المبلغ بالدولار:";
            } else if (transactionType === 2) { // أريد أن يصلني
                promptText = "برجاء ذكر المبلغ بالجنيه:";
            }
        } else if (operationType === 2) { // إيداع
            if (transactionType === 1) { // أريد دفع
                promptText = "برجاء ذكر المبلغ بالجنيه:";
            } else if (transactionType === 2) { // أريد أن يصلني
                promptText = "برجاء ذكر المبلغ بالدولار:";
            }
        }

        document.getElementById('amountPrompt').innerText = promptText;
    }

    function calculateTotal() {
        let amount = parseFloat(document.getElementById('amountInput').value);
        let total = 0;
        let resultText = "";

        if (operationType === 1) { // سحب
            if (transactionType === 1) { // أريد دفع
                total = amount * 49;
                resultText = "الإجمالي: " + total + " جنيه";
            } else if (transactionType === 2) { // أريد أن يصلني
                total = amount / 49;
                resultText = "الإجمالي: " + total + " دولار";
            }
        } else if (operationType === 2) { // إيداع
            if (transactionType === 1) { // أريد دفع
                total = amount / 52;
                resultText = "الإجمالي: " + total + " دولار";
            } else if (transactionType === 2) { // أريد أن يصلني
                total = amount * 52;
                resultText = "الإجمالي: " + total + " جنيه";
            }
        }

        document.getElementById('resultDiv').innerText = resultText;
    }
