let operationType = 0;
        let transactionType = 0;

        function selectOperation(type) {
            operationType = type;
            document.getElementById('step1').style.display = 'none';
            document.getElementById('step2').style.display = 'block';
        }

        function selectTransaction(type) {
            transactionType = type;
            document.getElementById('step2').style.display = 'none';
            document.getElementById('step3').style.display = 'block';

            let inputLabel = document.getElementById('inputLabel');
            if (operationType === 1 && transactionType === 1) {
                inputLabel.textContent = "برجاء ذكر المبلغ بالدولار:";
            } else if (operationType === 1 && transactionType === 2) {
                inputLabel.textContent = "برجاء ذكر المبلغ بالجنيه:";
            } else if (operationType === 2 && transactionType === 1) {
                inputLabel.textContent = "برجاء ذكر المبلغ بالجنيه:";
            } else if (operationType === 2 && transactionType === 2) {
                inputLabel.textContent = "برجاء ذكر المبلغ بالدولار:";
            }
        }

        function calculate() {
            let amount = parseFloat(document.getElementById('amountInput').value);
            let result = 0;

            if (isNaN(amount) || amount <= 0) {
                alert("برجاء إدخال مبلغ صحيح.");
                return;
            }

            if (operationType === 1) { // سحب
                if (transactionType === 1) { // أريد دفع
                    result = amount * 49;
                    document.getElementById('result').textContent = `الإجمالي: ${result.toFixed(2)} جنيه`;
                } else if (transactionType === 2) { // أريد أن يصلني
                    result = amount / 49;
                    document.getElementById('result').textContent = `الإجمالي: ${result.toFixed(2)} دولار`;
                }
            } else if (operationType === 2) { // إيداع
                if (transactionType === 1) { // أريد دفع
                    result = amount / 52;
                    document.getElementById('result').textContent = `الإجمالي: ${result.toFixed(2)} دولار`;
                } else if (transactionType === 2) { // أريد أن يصلني
                    result = amount * 52;
                    document.getElementById('result').textContent = `الإجمالي: ${result.toFixed(2)} جنيه`;
                }
            }

            // عرض زر إجراء حساب جديد بعد إتمام العملية
            document.getElementById('step3').style.display = 'none';
            document.getElementById('newCalculation').style.display = 'block';
        }

        function goBack(step) {
            if (step === 1) {
                document.getElementById('step1').style.display = 'block';
                document.getElementById('step2').style.display = 'none';
            } else if (step === 2) {
                document.getElementById('step2').style.display = 'block';
                document.getElementById('step3').style.display = 'none';
            }
        }

        function resetCalculation() {
            // إعادة تعيين جميع الخطوات للبدء من جديد
            operationType = 0;
            transactionType = 0;
            document.getElementById('amountInput').value = '';
            document.getElementById('result').textContent = '';
            document.getElementById('step1').style.display = 'block';
            document.getElementById('step2').style.display = 'none';
            document.getElementById('step3').style.display = 'none';
            document.getElementById('newCalculation').style.display = 'none';
        }
