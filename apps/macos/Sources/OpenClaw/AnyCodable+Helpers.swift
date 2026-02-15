import Foundation
import OpenClawCNKit
import OpenClawCNProtocol

// Prefer the OpenClawCNKit wrapper to keep gateway request payloads consistent.
typealias AnyCodable = OpenClawCNKit.AnyCodable
typealias InstanceIdentity = OpenClawCNKit.InstanceIdentity

extension AnyCodable {
    var stringValue: String? {
        self.value as? String
    }

    var boolValue: Bool? {
        self.value as? Bool
    }

    var intValue: Int? {
        self.value as? Int
    }

    var doubleValue: Double? {
        self.value as? Double
    }

    var dictionaryValue: [String: AnyCodable]? {
        self.value as? [String: AnyCodable]
    }

    var arrayValue: [AnyCodable]? {
        self.value as? [AnyCodable]
    }

    var foundationValue: Any {
        switch self.value {
        case let dict as [String: AnyCodable]:
            dict.mapValues { $0.foundationValue }
        case let array as [AnyCodable]:
            array.map(\.foundationValue)
        default:
            self.value
        }
    }
}

extension OpenClawCNProtocol.AnyCodable {
    var stringValue: String? {
        self.value as? String
    }

    var boolValue: Bool? {
        self.value as? Bool
    }

    var intValue: Int? {
        self.value as? Int
    }

    var doubleValue: Double? {
        self.value as? Double
    }

    var dictionaryValue: [String: OpenClawCNProtocol.AnyCodable]? {
        self.value as? [String: OpenClawCNProtocol.AnyCodable]
    }

    var arrayValue: [OpenClawCNProtocol.AnyCodable]? {
        self.value as? [OpenClawCNProtocol.AnyCodable]
    }

    var foundationValue: Any {
        switch self.value {
        case let dict as [String: OpenClawCNProtocol.AnyCodable]:
            dict.mapValues { $0.foundationValue }
        case let array as [OpenClawCNProtocol.AnyCodable]:
            array.map(\.foundationValue)
        default:
            self.value
        }
    }
}
