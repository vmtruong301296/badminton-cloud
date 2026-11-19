<?php

namespace App\Services\FuelPrice;

use DateTimeZone;

/**
 * Đọc bảng giá bán lẻ chính thức của Petrolimex qua API JSON mà chính
 * petrolimex.com.vn gọi để hiện nút "Giá bán lẻ xăng dầu" ở đầu trang
 * (hàm __vieapps.prices.fetch trong portals.petrolimex.com.vn/_themes/sunrise/js/all.js).
 *
 * Mỗi sản phẩm trong "Objects" có dạng:
 *
 *   {"Title": "Xăng E10 RON 95-III", "Zone1Price": 19840, "Zone2Price": 20230,
 *    "LastModified": "2026-11-12T07:50:29.63Z", ...}
 *
 * Dùng giá Vùng 1, cùng mức baohatinh.vn công bố.
 */
class PetrolimexFuelSource extends AbstractFuelPriceSource
{
    private const API_URL = 'https://portals.petrolimex.com.vn/~apis/portals/cms.item/search';

    // Mã kho dữ liệu "bảng giá bán lẻ" trên CMS của Petrolimex, chép nguyên
    // từ request của trang chủ. Petrolimex đổi CMS thì ba mã này đổi theo.
    private const SYSTEM_ID = '6783dc1271ff449e95b74a9520964169';

    private const REPOSITORY_ID = 'a95451e23b474fe5886bfb7cf843f53c';

    private const REPOSITORY_ENTITY_ID = '3801378fe1e045b1afa10de7c5776124';

    // LastModified trả theo giờ UTC; kỳ điều chỉnh giá tính theo giờ Việt Nam.
    private const LOCAL_TIMEZONE = 'Asia/Ho_Chi_Minh';

    public function name(): string
    {
        return 'petrolimex.com.vn';
    }

    public function url(string $fuelKey): string
    {
        $request = [
            'FilterBy' => ['And' => [
                ['SystemID' => ['Equals' => self::SYSTEM_ID]],
                ['RepositoryID' => ['Equals' => self::REPOSITORY_ID]],
                ['RepositoryEntityID' => ['Equals' => self::REPOSITORY_ENTITY_ID]],
                ['Status' => ['Equals' => 'Published']],
            ]],
            'SortBy' => ['LastModified' => 'Descending'],
            'Pagination' => ['TotalRecords' => -1, 'TotalPages' => 0, 'PageSize' => 0, 'PageNumber' => 0],
        ];

        // API nhận request là JSON mã base64url, bỏ dấu "=" ở cuối.
        $encoded = rtrim(strtr(base64_encode(json_encode($request)), '+/', '-_'), '=');

        return self::API_URL.'?x-request='.$encoded;
    }

    public function parse(string $html, string $pattern): ?array
    {
        // Nguồn này trả JSON chứ không phải HTML; giữ tên tham số theo interface.
        $data = json_decode($html, true);

        if (! is_array($data) || ! is_array($data['Objects'] ?? null)) {
            return null;
        }

        foreach ($data['Objects'] as $product) {
            // So khớp NGUYÊN chuỗi: có cả "E10 RON 95-III" lẫn "E10 RON 95-V".
            if (! is_array($product) || ($product['Title'] ?? null) !== 'Xăng '.$pattern) {
                continue;
            }

            $price = $this->toValidPrice((string) ($product['Zone1Price'] ?? ''));

            if ($price === null) {
                return null;
            }

            return ['price' => $price, 'date' => $this->localDate($product['LastModified'] ?? null)];
        }

        return null;
    }

    /** Ngày (giờ Việt Nam) của lần Petrolimex sửa giá; null nếu không đọc được. */
    private function localDate(mixed $value): ?string
    {
        $time = is_string($value) ? date_create_immutable($value) : false;

        if ($time === false) {
            return null;
        }

        return $time->setTimezone(new DateTimeZone(self::LOCAL_TIMEZONE))->format('Y-m-d');
    }
}
