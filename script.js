document.getElementById('binance-btn').addEventListener('click', function() {
            document.getElementById('action-container').classList.remove('hidden');
            document.getElementById('action-container').innerHTML = `
                <button id="charge-btn">شحن</button>
                <button id="withdraw-btn">سحب</button>
            `;
            document.getElementById('exchange-rate').innerText = '52';
            setUpActionButtons('binance');
        });

        document.getElementById('redotpay-btn').addEventListener('click', function() {
            document.getElementById('action-container').classList.remove('hidden');
            document.getElementById('action-container').innerHTML = `
                <button id="charge-btn">شحن</button>
                <button id="withdraw-btn">سحب رصيد</button>
            `;
            document.getElementById('exchange-rate').innerText = '52';
            setUpActionButtons('redotpay');
        });

        function setUpActionButtons(method) {
            document.getElementById('charge-btn').addEventListener('click', function() {
                document.getElementById('form-container').classList.remove('hidden');
                document.getElementById('action-message').innerText = 'ادخل المبلغ:';
                document.getElementById('amount').addEventListener('input', function() {
                    calculateTotal(method, 'charge');
                });
            });

            document.getElementById('withdraw-btn').addEventListener('click', function() {
                document.getElementById('form-container').classList.remove('hidden');
                document.getElementById('action-message').innerText = 'ادخل المبلغ:';
                document.getElementById('amount').addEventListener('input', function() {
                    calculateTotal(method, 'withdraw');
                });
            });
        }

        function calculateTotal(method, action) {
            const amount = parseFloat(document.getElementById('amount').value) || 0;
            let exchangeRate = parseFloat(document.getElementById('exchange-rate').innerText);
            let total;
            
            if (method === 'binance') {
                exchangeRate = action === 'charge' ? 52 : 49;
            } else if (method === 'redotpay') {
                exchangeRate = action === 'charge' ? 52 : 49;
            }

            if (action === 'charge') {
                total = Math.ceil(amount * exchangeRate);
            } else if (action === 'withdraw') {
                total = Math.floor(amount * exchangeRate);
            }

            document.getElementById('total-amount').innerText = total;
        }
