<?php

namespace Tests\Unit;

use App\Services\MatchBillCalculator;
use PHPUnit\Framework\TestCase;

/**
 * Chia tiền bill theo trận: tiền sân chia đều cho số trận, phần sân của mỗi
 * trận chia cho người đánh trận đó; tiền cầu của trận chia cho người đánh trận đó.
 */
class MatchBillCalculatorTest extends TestCase
{
    private const TRUONG = 1;

    private const NGUYEN = 2;

    private const HIEN = 3;

    private const HUYNH = 4;

    private const LOC = 5;

    private const TAN = 6;

    private function shares(int $courtTotal, array $matches): array
    {
        return (new MatchBillCalculator)->shares($courtTotal, $matches);
    }

    public function test_vi_du_2_tran_san_55k(): void
    {
        $shares = $this->shares(55000, [
            ['player_ids' => [self::TRUONG, self::NGUYEN, self::HIEN, self::HUYNH], 'subtotal' => 26000],
            ['player_ids' => [self::TRUONG, self::HIEN, self::LOC, self::TAN], 'subtotal' => 56000],
        ]);

        $this->assertSame([
            self::TRUONG => 34250,
            self::NGUYEN => 13375,
            self::HIEN => 34250,
            self::HUYNH => 13375,
            self::LOC => 20875,
            self::TAN => 20875,
        ], $shares);
        $this->assertSame(55000 + 26000 + 56000, array_sum($shares));
    }

    public function test_tran_don_chia_san_va_cau_cho_2_nguoi(): void
    {
        $shares = $this->shares(60000, [
            ['player_ids' => [self::TRUONG, self::NGUYEN, self::HIEN, self::HUYNH], 'subtotal' => 24000],
            ['player_ids' => [self::TRUONG, self::NGUYEN], 'subtotal' => 26000],
        ]);

        // Trận 1: 30.000/4 + 24.000/4 = 13.500; trận 2: 30.000/2 + 26.000/2 = 28.000
        $this->assertSame(13500 + 28000, $shares[self::TRUONG]);
        $this->assertSame(13500 + 28000, $shares[self::NGUYEN]);
        $this->assertSame(13500, $shares[self::HIEN]);
        $this->assertSame(13500, $shares[self::HUYNH]);
    }

    public function test_lam_tron_tong_cua_tung_nguoi_khong_lam_tron_tung_tran(): void
    {
        // 10.000 / 3 trận / 4 người = 833,33 mỗi lượt đánh
        $shares = $this->shares(10000, [
            ['player_ids' => [self::TRUONG, self::NGUYEN, self::HIEN, self::HUYNH], 'subtotal' => 0],
            ['player_ids' => [self::TRUONG, self::NGUYEN, self::LOC, self::TAN], 'subtotal' => 0],
            ['player_ids' => [self::TRUONG, self::HIEN, self::LOC, self::TAN], 'subtotal' => 0],
        ]);

        $this->assertSame(2500, $shares[self::TRUONG]);
        $this->assertSame(833, $shares[self::HUYNH]);
    }

    public function test_khong_co_tran_thi_khong_ai_tra(): void
    {
        $this->assertSame([], $this->shares(55000, []));
    }
}
