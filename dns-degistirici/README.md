# DNS Değiştirici (Windows)

Masaüstünden çift tıklayınca DNS'i **Google DNS**'e çeviren küçük araç.

- IPv4: `8.8.8.8` / `8.8.4.4`
- IPv6: `2001:4860:4860::8888` / `2001:4860:4860::8844`

## Kurulum

1. `DNS-Degistir.bat` dosyasını indirip **masaüstüne** kopyalayın.
2. Çift tıklayın, çıkan yönetici izni penceresinde **Evet** deyin.

## Nasıl çalışır?

- **İlk tıklama:** Bağlı tüm ağ bağdaştırıcılarında (Wi-Fi / Ethernet) DNS'i Google'a çevirir ve DNS önbelleğini temizler.
- **Tekrar tıklama:** Google DNS zaten aktifse, eski otomatik (DHCP) DNS ayarlarına dönmek isteyip istemediğinizi sorar (`E` / `H`).
- Sonunda güncel DNS sunucularını ekranda gösterir.

## İpucu: Güzel bir kısayol

Masaüstünde `.bat` yerine ikonlu bir kısayol isterseniz: dosyaya sağ tık → **Gönder → Masaüstü (kısayol oluştur)** → kısayola sağ tık → **Özellikler → Simge Değiştir**.

> Not: Bu araç gerçek bir VPN değildir; IP adresinizi gizlemez, trafiği şifrelemez. Sadece DNS sunucusunu değiştirir (DNS tabanlı engelleri aşmak ve daha hızlı çözümleme için yeterlidir).
