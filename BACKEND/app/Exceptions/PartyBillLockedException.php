<?php

namespace App\Exceptions;

use Exception;

/**
 * Ném khi một thao tác sẽ làm đổi tiền của một bill tiệc mà mọi người tham
 * gia đều đã thanh toán. Giữ đúng bất biến sẵn có của PartyBillController.
 */
class PartyBillLockedException extends Exception
{
    public function __construct(public readonly string $billName)
    {
        parent::__construct(
            "Bill tiệc «{$billName}» đã thanh toán hết nên không sửa được. "
            .'Hãy bỏ đánh dấu thanh toán của ít nhất một người trước khi gắn hoặc gỡ chuyến xe.'
        );
    }
}
