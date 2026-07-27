// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

contract HienMauAffiliate {
    address public owner;

    // Lưu trữ tuyến trên của một user: referrers[Ví_Của_B] = Ví_Của_A
    mapping(address => address) public referrers;
    
    // Lưu trữ số dư (Token/VNĐ nội bộ) của user
    mapping(address => uint256) public balances;

    // Tỷ lệ hoa hồng (%): F1 (10%), F2 (5%), F3 (2%)
    uint256[] public levelRates = [10, 5, 2];

    // Bộ đếm thời gian (cooldown) để chống spam Click (4 giờ)
    mapping(address => uint256) public lastTaskTime;

    event ReferralRegistered(address indexed user, address indexed referrer);
    event TaskRewarded(address indexed user, uint256 amount);
    event CommissionPaid(address indexed from, address indexed to, uint256 level, uint256 amount);

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    // ==========================================
    // 1. ĐĂNG KÝ TUYẾN TRÊN (Mối quan hệ F1)
    // ==========================================
    function registerReferral(address _referrer) external {
        require(_referrer != address(0), "Invalid referrer");
        require(_referrer != msg.sender, "Cannot refer yourself");
        require(referrers[msg.sender] == address(0), "Already registered");

        referrers[msg.sender] = _referrer;
        emit ReferralRegistered(msg.sender, _referrer);
    }

    // ==========================================
    // 2. NHẬN THƯỞNG & CHIA HOA HỒNG ĐA TẦNG
    // ==========================================
    // (Trong thực tế Web3, hàm này nên xác thực chữ ký Backend. 
    // Ở demo này, ta dùng Cooldown 4 giờ để chống Spam).
    function rewardTask(uint256 _baseAmount) external {
        // Kiểm tra Cooldown 4 giờ (14400 giây)
        require(block.timestamp >= lastTaskTime[msg.sender] + 4 hours, "Task cooldown active: come back later");
        lastTaskTime[msg.sender] = block.timestamp;

        // Cộng tiền gốc cho User làm nhiệm vụ (Ví dụ: B được 5000)
        balances[msg.sender] += _baseAmount;
        emit TaskRewarded(msg.sender, _baseAmount);

        // --- THUẬT TOÁN ĐỆ QUY CHIA HOA HỒNG (MLM ENGINE) ---
        address currentUpline = referrers[msg.sender];
        
        // Vòng lặp chạy lên F1, F2, F3... tùy theo cấu hình levelRates
        for (uint256 i = 0; i < levelRates.length; i++) {
            if (currentUpline == address(0)) {
                break; // Nếu không còn tuyến trên nào nữa thì dừng vòng lặp
            }

            // Tính % hoa hồng (Ví dụ: 5000 * 10 / 100 = 500)
            uint256 commission = (_baseAmount * levelRates[i]) / 100;
            
            // Chuyển thẳng hoa hồng vào số dư của tuyến trên
            balances[currentUpline] += commission;
            emit CommissionPaid(msg.sender, currentUpline, i + 1, commission);

            // Gán lại currentUpline thành người giới thiệu của currentUpline (Dò tiếp lên F2, F3)
            currentUpline = referrers[currentUpline];
        }
    }

    // ==========================================
    // CÁC HÀM QUẢN TRỊ (ADMIN)
    // ==========================================
    
    // Đổi tỷ lệ chia % hoặc thêm Tầng (F4, F5...) bất cứ lúc nào
    function setLevelRates(uint256[] calldata _newRates) external onlyOwner {
        levelRates = _newRates;
    }

    // (Tùy chọn) Rút tiền thật về ví nếu cần tích hợp mua bán
    // ...
}